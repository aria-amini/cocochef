import { describe, expect, test } from 'vite-plus/test'

import { byLoved, lovedScore } from './loved'

describe('lovedScore', () => {
	test('trusts many ratings over a few perfect ones', () => {
		expect(lovedScore({ value: 4.8, count: 500 })).toBeGreaterThan(
			lovedScore({ value: 5, count: 2 }),
		)
	})

	test('ranks an unrated recipe last, and lets comments tip a tie', () => {
		const rated = { value: 3.5, count: 30 }

		expect(lovedScore(rated)).toBeGreaterThan(lovedScore(undefined, 40))
		expect(lovedScore(rated, 300)).toBeGreaterThan(lovedScore(rated))
	})

	test('sorts the most loved first, keeping the order of equals', () => {
		const recipes = [
			{ title: 'a' },
			{ title: 'b', rating: { value: 4.9, count: 900 } },
			{ title: 'c' },
		]

		expect(
			byLoved(recipes, (recipe) => lovedScore(recipe.rating)).map(
				({ title }) => title,
			),
		).toEqual(['b', 'a', 'c'])
	})
})
