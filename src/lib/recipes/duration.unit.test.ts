import { describe, expect, test } from 'vite-plus/test'

import { shortDuration } from './duration'

describe('shortDuration', () => {
	test.each([
		[5, '5m'],
		[45, '45m'],
		[60, '1h'],
		[90, '1h 30m'],
		[150, '2h 30m'],
		[240, '4h'],
		[615, '10h'],
		[1440, '1d'],
		[1500, '1d 1h'],
		[2880 + 240, '2d 4h'],
	])('says %i minutes as %s', (minutes, said) => {
		expect(shortDuration(minutes)).toBe(said)
	})
})
