import { afterEach, describe, expect, test, vi } from 'vite-plus/test'

import { createRecipeHandoff } from './handoff'

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

const pasta = { id: 'pasta', publicPath: '/aria/pasta' }

describe('a recipe handed from the id route to the loads behind it', () => {
	test('is found by its id or its readable address', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'preload')

		expect(handoff.get('pasta', 'enter')).toBe(pasta)
		expect(handoff.get('/aria/pasta', 'preload')).toBe(pasta)
		expect(handoff.get('soup', 'enter')).toBeUndefined()
	})

	test('hands a visit’s read on only to the address it redirects to', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'enter')

		expect(handoff.get('/aria/pasta', 'enter')).toBe(pasta)
		// A visit by id, as after an edit, reads the recipe again.
		expect(handoff.get('pasta', 'enter')).toBeUndefined()
	})

	test('is never handed on by a reload', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'stay')

		expect(handoff.get('/aria/pasta', 'enter')).toBeUndefined()
	})

	test('is not taken by a reload of the page, which reads it as it now is', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'preload')

		expect(handoff.get('pasta', 'stay')).toBeUndefined()
	})

	test('is gone after a moment', () => {
		vi.stubGlobal('window', {})
		vi.useFakeTimers()
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'preload')
		vi.advanceTimersByTime(2_000)

		expect(handoff.get('pasta', 'enter')).toBeUndefined()
	})

	test('is never kept on the server, where every request would share it', () => {
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'preload')

		expect(handoff.get('pasta', 'enter')).toBeUndefined()
	})
})
