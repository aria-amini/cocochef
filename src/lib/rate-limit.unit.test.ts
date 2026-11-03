import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vite-plus/test'

import { createRateLimiter, createSlots } from './rate-limit'

describe('createRateLimiter', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test('allows the limit and rejects the next call with its own message', () => {
		const check = createRateLimiter({ limit: 2, message: 'slow down' })

		check('a')
		check('a')

		expect(() => check('a')).toThrow('slow down')
	})

	test('counts each key on its own', () => {
		const check = createRateLimiter({ limit: 1, message: 'slow down' })

		check('a')

		expect(() => check('b')).not.toThrow()
	})

	test('starts a new window once the old one ends', () => {
		const check = createRateLimiter({
			limit: 1,
			windowMs: 1_000,
			message: 'slow down',
		})

		check('a')
		vi.advanceTimersByTime(1_000)

		expect(() => check('a')).not.toThrow()
	})

	test('limiters do not share state', () => {
		const first = createRateLimiter({ limit: 1, message: 'first' })
		const second = createRateLimiter({ limit: 1, message: 'second' })

		first('a')

		expect(() => second('a')).not.toThrow()
	})
})

describe('createSlots', () => {
	test('rejects past the per-key cap and frees the slot afterward', async () => {
		const withSlot = createSlots({ max: 5, maxPerKey: 1, message: 'busy' })
		let release: () => void = () => {}

		const held = withSlot(
			'a',
			() => new Promise<void>((resolve) => (release = resolve)),
		)

		await expect(withSlot('a', async () => 1)).rejects.toThrow('busy')
		await expect(withSlot('b', async () => 2)).resolves.toBe(2)

		release()
		await held

		await expect(withSlot('a', async () => 3)).resolves.toBe(3)
	})

	test('frees the slot when the task throws', async () => {
		const withSlot = createSlots({ max: 1, maxPerKey: 1, message: 'busy' })

		await expect(
			withSlot('a', async () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')
		await expect(withSlot('a', async () => 1)).resolves.toBe(1)
	})
})
