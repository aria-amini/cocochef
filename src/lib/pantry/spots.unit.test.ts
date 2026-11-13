import { describe, expect, test } from 'vite-plus/test'

import type { PantryCategory } from './model'
import { shelvesOf, spotOf } from './spots'

describe('spotOf', () => {
	test.each([
		['cumin', 'spices', 'pantry'],
		['frozen peas', 'frozen', 'freezer'],
		['chicken thighs', 'meat', 'fridge'],
		['eggs', 'dairy', 'fridge'],
		['spinach', 'vegetables', 'fridge'],
		['cilantro', 'vegetables', 'fridge'],
		['onion', 'vegetables', 'counter'],
		['potatoes', 'vegetables', 'counter'],
		['bananas', 'fruit', 'counter'],
		['avocados', 'fruit', 'counter'],
		['rice', 'grains', 'pantry'],
		['olive oil', 'sauces', 'pantry'],
		['dijon mustard', 'sauces', 'fridge'],
	] as const)('keeps %s (%s) in the %s', (name, category, spot) => {
		expect(spotOf({ name, category })).toBe(spot)
	})
})

describe('shelvesOf', () => {
	const shelves = (
		spot: Parameters<typeof shelvesOf>[0],
		foods: [string, PantryCategory][],
	) =>
		shelvesOf(
			spot,
			foods.map(([name, category]) => ({ name, category })),
		).map((shelf) => [shelf.label, shelf.items.map((item) => item.name)])

	test('keeps the spices on a shelf of the pantry', () => {
		expect(
			shelves('pantry', [
				['cumin', 'spices'],
				['oregano', 'spices'],
				['olive oil', 'sauces'],
			]),
		).toEqual([
			['oils & vinegars', ['olive oil']],
			['spices & dried herbs', ['cumin', 'oregano']],
		])
	})

	test('shelves the pantry, with cans and herbs apart', () => {
		expect(
			shelves('pantry', [
				['olive oil', 'sauces'],
				['soy sauce', 'sauces'],
				['flour', 'grains'],
				['rice', 'grains'],
				['black beans', 'cans'],
				['diced tomatoes', 'cans'],
				['honey', 'sauces'],
				['almonds', 'other'],
			]),
		).toEqual([
			['oils & vinegars', ['olive oil']],
			['baking', ['flour']],
			['sweet things & spreads', ['honey']],
			['beans & lentils', ['black beans']],
			['nuts & dried fruit', ['almonds']],
			['cans & cartons', ['diced tomatoes']],
			['sauces & condiments', ['soy sauce']],
			['grains & pasta', ['rice']],
		])
		expect(
			shelves('fridge', [
				['parsley', 'vegetables'],
				['spinach', 'vegetables'],
				['milk', 'dairy'],
				['mayonnaise', 'sauces'],
			]),
		).toEqual([
			['fresh herbs', ['parsley']],
			['fruit & veg', ['spinach']],
			['dairy & eggs', ['milk']],
			['door', ['mayonnaise']],
		])
	})
})
