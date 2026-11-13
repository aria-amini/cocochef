import { describe, expect, test } from 'vite-plus/test'

import { hadItIn, lineStatus, wantsBuying } from './status'

const since = new Date('2026-03-02T12:00:00Z')

const pantry = [
	{
		name: 'garlic',
		level: 'plenty' as const,
		stale: false,
		confirmedAt: since,
	},
	{ name: 'milk', level: 'low' as const, stale: false, confirmedAt: since },
	{ name: 'flour', level: 'plenty' as const, stale: true, confirmedAt: since },
	{ name: 'eggs', level: 'out' as const, stale: false, confirmedAt: since },
]

describe('lineStatus', () => {
	test('says what the kitchen has of each line', () => {
		const status = (line: string, waiting: string[] = []) =>
			lineStatus(line, pantry, waiting)?.kind

		expect(status('2 cloves garlic, minced')).toBe('have')
		expect(status('1 cup milk')).toBe('low')
		expect(status('2 cups flour')).toBe('stale')
		expect(status('3 eggs')).toBe('need')
		expect(status('2 lb short ribs')).toBe('need')
		expect(status('2 lb short ribs', ['3 lb short ribs'])).toBe('list')
		expect(status('1 cup water')).toBeUndefined()
	})

	test('buys what is needed, low or not seen lately', () => {
		const buys = (line: string) => wantsBuying(lineStatus(line, pantry, []))

		expect(buys('3 eggs')).toBe(true)
		expect(buys('1 cup milk')).toBe(true)
		expect(buys('2 cups flour')).toBe(true)
		expect(buys('garlic')).toBe(false)
	})

	test('says when a stale item was last had', () => {
		expect(hadItIn(since)).toBe('had it in march')
	})
})
