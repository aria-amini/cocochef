import { afterEach, describe, expect, test, vi } from 'vite-plus/test'

import { createRecipeHandoff } from './handoff'

afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

const pasta = { id: 'pasta', publicPath: '/aria/pasta' }

describe('a recipe handed from a preload to the loads behind it', () => {
	test('is found by its id or its readable address', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'preload')

		expect(handoff.get('pasta', 'enter')).toBe(pasta)
		expect(handoff.get('/aria/pasta', 'preload')).toBe(pasta)
		expect(handoff.get('soup', 'enter')).toBeUndefined()
	})

	test('is only handed on by a preload, never by a visit or a reload', () => {
		vi.stubGlobal('window', {})
		const handoff = createRecipeHandoff<typeof pasta>()

		handoff.hand(pasta, 'enter')
		handoff.hand(pasta, 'stay')

		expect(handoff.get('pasta', 'enter')).toBeUndefined()
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
