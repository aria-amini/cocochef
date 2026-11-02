import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vite-plus/test'

import { createAutosaver, type SaveState } from './autosave'
import type { RecipeContent } from './model'

const content = (title: string): RecipeContent => ({
	title,
	notes: '',
	ingredients: [],
	steps: [],
})

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

function setup(save: (content: RecipeContent) => Promise<void>) {
	let current: RecipeContent | undefined = content('toast')
	const states: SaveState[] = []

	const saver = createAutosaver({
		read: () => current,
		save,
		report: (state) => states.push(state),
	})

	return {
		saver,
		states,
		change: (title: string) => {
			current = content(title)
		},
		gone: () => {
			saver.remember()
			current = undefined
		},
	}
}

describe('autosaver', () => {
	test('saves a change once, after the pause', async () => {
		const save = vi.fn(async () => {})
		const { saver, change } = setup(save)
		saver.start(true)
		change('toast 2')
		saver.schedule()

		await vi.advanceTimersByTimeAsync(700)

		expect(save).toHaveBeenCalledTimes(1)
	})

	test('keeps retrying a failed save while the editor is open', async () => {
		const save = vi.fn(async () => {
			throw new Error('offline')
		})

		const { saver, change, states } = setup(save)
		saver.start(true)
		change('toast 2')
		await saver.flush()

		await vi.advanceTimersByTimeAsync(3_100)

		expect(save).toHaveBeenCalledTimes(2)
		expect(states.at(-1)).toBe('failed')
	})

	test('does not retry a failed save after the editor is gone', async () => {
		const save = vi.fn(async () => {
			throw new Error('offline')
		})

		const { saver, change, gone } = setup(save)
		saver.start(true)
		change('toast 2')
		gone()

		saver.detach()
		await saver.flush()
		await vi.advanceTimersByTimeAsync(60_000)

		expect(save).toHaveBeenCalledTimes(1)
	})

	test('saves a prefilled new recipe that nothing has saved yet', async () => {
		const save = vi.fn(async () => {})
		const { saver } = setup(save)
		saver.start(false)

		await saver.flush()

		expect(save).toHaveBeenCalledTimes(1)
	})

	test('saves again after a stop is taken back', async () => {
		const save = vi.fn(async () => {})
		const { saver, change } = setup(save)
		saver.start(true)
		saver.stop()
		change('toast 2')

		await saver.flush()
		expect(save).not.toHaveBeenCalled()

		saver.resume()
		await saver.flush()

		expect(save).toHaveBeenCalledTimes(1)
	})
	test('saves identical content again after its persisted copy is forgotten', async () => {
		const save = vi.fn(async () => {})
		const { saver } = setup(save)
		saver.start(false)
		await saver.flush()
		saver.stop()
		await saver.settle()
		saver.forget()
		saver.resume()
		await saver.flush()
		expect(save).toHaveBeenCalledTimes(2)
	})
})
