import { describe, expect, test } from 'vite-plus/test'

import { catalogSections } from '@/lib/pantry/catalog'

import { ingredientCategory, ingredientViewRows } from './ingredient-groups'

describe('ingredient display groups', () => {
	test('matches catalog foods conservatively', () => {
		expect(ingredientCategory('2 large eggs, beaten')).toBe('dairy')
		expect(ingredientCategory('200 g pasta')).toBe('grains')
		expect(ingredientCategory('2 fresh carrots, chopped')).toBe('vegetables')
		expect(ingredientCategory('1 cup mystery sauce')).toBe('other')
		expect(ingredientCategory('1 cup unsweetened almond milk')).toBe('dairy')
		expect(ingredientCategory('1 tablespoon extra-virgin olive oil')).toBe(
			'sauces',
		)
		expect(ingredientCategory('2 cups all-purpose flour')).toBe('grains')
		expect(ingredientCategory('400 g canned crushed tomatoes')).toBe('cans')
		expect(ingredientCategory('1 onion, finely diced')).toBe('vegetables')
		expect(
			ingredientCategory('2 tablespoons freshly squeezed lemon juice'),
		).toBe('fruit')
	})
	test('uses the Ingredients catalog assignments for every catalog food', () => {
		for (const section of catalogSections)
			for (const item of section.items) {
				expect(ingredientCategory(`2 cups ${item}`), item).toBe(section.id)
			}
	})

	test('hides imported Ingredients and Garnish labels only in category mode', () => {
		const lines = [
			'## Ingredients',
			'1 carrot',
			'## Garnish (optional)',
			'1 egg',
		]

		expect(ingredientViewRows(lines, true).map(({ text }) => text)).toEqual([
			'dairy & eggs',
			'1 egg',
			'vegetables & herbs',
			'1 carrot',
		])
		expect(ingredientViewRows(lines, false).map(({ text }) => text)).toEqual([
			'1 carrot',
			'Garnish (optional)',
			'1 egg',
		])
	})

	test('groups across source sections without losing duplicate lines or original indices', () => {
		const lines = [
			'## sauce',
			'1 carrot',
			'2 eggs',
			'## filling',
			'2 eggs',
			'1 carrot',
		]

		const rows = ingredientViewRows(lines, true)
		expect(rows.map(({ text }) => text)).toEqual([
			'dairy & eggs',
			'2 eggs',
			'2 eggs',
			'vegetables & herbs',
			'1 carrot',
			'1 carrot',
		])
		expect(
			rows.filter((row) => row.kind === 'ingredient').map((row) => row.index),
		).toEqual([2, 4, 1, 5])
		expect(ingredientViewRows(lines, false).map(({ text }) => text)).toEqual([
			'sauce',
			'1 carrot',
			'2 eggs',
			'filling',
			'2 eggs',
			'1 carrot',
		])
		expect(lines[0]).toBe('## sauce')
	})
})
