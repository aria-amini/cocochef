import { expect, test } from 'vite-plus/test'

import { photoSlot, resizePhoto } from './resize.server'

test('makes two photos at a time, keeps a few waiting, and turns the rest away', async () => {
	const releases: (() => void)[] = []
	const started: number[] = []

	const job = (n: number) => () =>
		new Promise<number>((resolve) => {
			started.push(n)
			releases.push(() => resolve(n))
		})

	const all = Array.from({ length: 18 }, (_, n) => photoSlot(job(n)))
	const turnedAway = await photoSlot(job(18))

	await Promise.resolve()
	expect(started).toEqual([0, 1])
	expect(turnedAway).toBeNull()

	// Each one done lets the next waiting one in, until all have run.
	while (releases.length) {
		releases.shift()?.()
		await new Promise((resolve) => setTimeout(resolve, 0))
	}

	expect(await Promise.all(all)).toEqual(
		Array.from({ length: 18 }, (_, n) => n),
	)
})

test('never makes more than two at once, even when one arrives as a slot is handed on', async () => {
	let active = 0
	let most = 0
	const releases: (() => void)[] = []

	const job = () =>
		new Promise<void>((resolve) => {
			active += 1
			most = Math.max(most, active)
			releases.push(() => {
				active -= 1
				resolve()
			})
		})

	// For each offset: fill both slots and the queue, free one slot, and
	// ask for another photo that many microtasks later.
	for (let offset = 0; offset < 6; offset++) {
		const pending = [photoSlot(job), photoSlot(job), photoSlot(job)]

		await Promise.resolve()
		releases.shift()?.()

		for (let tick = 0; tick < offset; tick++) await Promise.resolve()

		pending.push(photoSlot(job))

		while (releases.length || active) {
			await new Promise((resolve) => setTimeout(resolve, 0))
			releases.shift()?.()
		}

		await Promise.all(pending)
	}

	expect(most).toBeLessThanOrEqual(2)
})

test('fails an empty photo as a rejection, for the caller to fall back on', async () => {
	await expect(resizePhoto(new Uint8Array(), 400)).rejects.toThrow()
})
