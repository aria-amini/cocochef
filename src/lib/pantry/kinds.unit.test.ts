import { describe, expect, test } from 'vite-plus/test'

import {
	pantryPlaces,
	pantryShelves,
	shelfOf,
	shelfOfAisle,
	shelfOfItem,
} from './kinds'

describe('shelves', () => {
	test('puts each food on the shelf it is kept on', () => {
		expect(shelfOf('milk', 'dairy').id).toBe('fridge')
		expect(shelfOf('chicken thighs', 'meat').id).toBe('fridge')
		expect(shelfOf('cumin', 'spices').id).toBe('spices')
		expect(shelfOf('soy sauce', 'sauces').id).toBe('sauces')
		expect(shelfOf('frozen peas', 'frozen').id).toBe('freezer')
	})

	test('moves a frozen food to the freezer, whatever it is', () => {
		const chicken = { name: 'chicken thighs', category: 'meat' as const }

		expect(shelfOfItem(chicken).id).toBe('fridge')
		expect(shelfOfItem({ ...chicken, frozenAt: new Date() }).id).toBe('freezer')
	})

	test('opens an old aisle link on its shelf', () => {
		expect(shelfOfAisle('dairy')).toBe('fridge')
		expect(shelfOfAisle('spices')).toBe('spices')
	})

	test('keeps every shelf in a place, cold ones first', () => {
		expect(
			pantryShelves.every((shelf) => pantryPlaces.includes(shelf.place)),
		).toBe(true)
		expect(pantryShelves.slice(0, 2).map((shelf) => shelf.place)).toEqual([
			'refrigerator',
			'refrigerator',
		])
	})
})
