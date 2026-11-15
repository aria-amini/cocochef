import { expect, test } from 'vite-plus/test'

import { photoSlot } from './resize.server'

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
