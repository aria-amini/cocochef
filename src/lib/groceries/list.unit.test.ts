import { describe, expect, test } from 'vite-plus/test'

import { groceryLine, groceryList } from './list'

describe('groceryLine', () => {
	test('leaves the preparation in the kitchen', () => {
		expect(groceryLine('2 cloves garlic, minced')).toBe('2 cloves garlic')
		expect(groceryLine('1 onion, finely chopped')).toBe('1 onion')
	})

	test('keeps a size in brackets before the food', () => {
		expect(groceryLine('1 (15-ounce) can chickpeas, rinsed')).toBe(
			'1 (15-ounce) can chickpeas',
		)
	})

	test('drops a trailing note in brackets', () => {
		expect(groceryLine('200 g pasta (any short shape)')).toBe('200 g pasta')
	})

	test('keeps a line that is only a note', () => {
		expect(groceryLine('(optional)')).toBe('(optional)')
	})
})

describe('groceryList', () => {
	test('lists the lines to buy, without section names', () => {
		const lines = ['## for the sauce', '1 onion, diced', '2 tbsp butter', '']

		expect(groceryList(lines)).toEqual(['1 onion', '2 tbsp butter'])
	})
})
