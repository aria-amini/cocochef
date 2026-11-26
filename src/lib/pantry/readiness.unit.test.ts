import { describe, expect, test } from 'vite-plus/test'

import { readinessOf } from './readiness'

const since = new Date('2026-03-02T12:00:00Z')

const kept = (
	name: string,
	level: 'plenty' | 'low' | 'out',
	stale = false,
) => ({
	name,
	level,
	stale,
	confirmedAt: since,
})

describe('readinessOf', () => {
	test('counts what is home and what is on the list for the recipe', () => {
		const lines = [
			'## Sauce',
			'2 cloves garlic, minced',
			'1 cup milk',
			'2 cups flour',
			'2 lb short ribs',
			'1 ripe avocado',
			'1 cup water',
			'3 eggs',
		]

		const pantry = [
			kept('garlic', 'plenty'),
			// Running low is still home.
			kept('milk', 'low'),
			// Not seen in a while, it's to buy again.
			kept('flour', 'plenty', true),
			kept('eggs', 'out'),
		]

		// Bought already, or still waiting: on the list either way.
		expect(readinessOf(lines, pantry, [{ text: '2 lb short ribs' }])).toEqual({
			home: 2,
			listed: 1,
			total: 6,
		})
	})

	test('counts each food once, as the list takes it', () => {
		const lines = ['## Dough', '1 tsp salt', '## Filling', '½ tsp salt']

		expect(readinessOf(lines, [kept('salt', 'plenty')], [])).toEqual({
			home: 1,
			listed: 0,
			total: 1,
		})
	})

	test('leaves out what the cook is doing without', () => {
		const lines = ['1 lemon', '2 cloves garlic', '1 bunch parsley']

		expect(
			readinessOf(lines, [kept('garlic', 'plenty')], [], ['1 bunch parsley']),
		).toEqual({ home: 1, listed: 0, total: 2 })
	})

	test('says nothing of a recipe that needs nothing bought', () => {
		expect(readinessOf(['1 cup water', ''], [], [])).toBeUndefined()
	})
})
