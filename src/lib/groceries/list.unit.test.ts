import { describe, expect, test } from 'vite-plus/test'

import { groceryLine, groceryList, shoppingLine } from './list'

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

	test('keeps a comma that is part of what to buy', () => {
		expect(groceryLine('2 large, ripe tomatoes')).toBe('2 large, ripe tomatoes')
		expect(groceryLine('2 large, red tomatoes')).toBe('2 large, red tomatoes')
		expect(groceryLine('1 cup salted, roasted peanuts')).toBe(
			'1 cup salted, roasted peanuts',
		)
		expect(groceryLine('2 organic, dried apricots')).toBe(
			'2 organic, dried apricots',
		)
		expect(groceryLine('1 cup fresh, curly parsley')).toBe(
			'1 cup fresh, curly parsley',
		)
		expect(groceryLine('1 cup fresh, seaweed')).toBe('1 cup fresh, seaweed')
		expect(groceryLine('1 cup mixed, seeds')).toBe('1 cup mixed, seeds')
		expect(groceryLine('1 onion, very finely chopped')).toBe('1 onion')
		expect(groceryLine('1 carrot, peeled and cut into 1-inch pieces')).toBe(
			'1 carrot',
		)
		expect(groceryLine('1,000 g potatoes, peeled')).toBe('1,000 g potatoes')
		expect(groceryLine('salt, to taste')).toBe('salt')
	})

	test('keeps an amount in brackets at the end', () => {
		expect(groceryLine('tomatoes (2 x 400 g cans)')).toBe(
			'tomatoes (2 x 400 g cans)',
		)
	})

	test('keeps a line that is only a note', () => {
		expect(groceryLine('(optional)')).toBe('(optional)')
	})
})

describe('groceryList', () => {
	test('lists the lines to buy, without section names', () => {
		const lines = ['## for the sauce', '1 onion, diced', '2 tbsp butter', '']

		expect(groceryList(lines)).toEqual(['1 onion', 'butter'])
	})
	test('leaves out the water and ice nobody shops for', () => {
		const lines = ['1 cup warm water', '2 cups chicken broth', 'ice, to serve']

		expect(groceryList(lines)).toEqual(['chicken broth'])
	})
})

describe('shoppingLine', () => {
	test.each([
		['1 tsp ground cumin', 'cumin'],
		['2 tbsp soy sauce', 'soy sauce'],
		['1 cup whole milk', 'milk'],
		['200 g pasta (any short shape)', 'pasta'],
		['1/2 cup grated parmesan', 'parmesan'],
		['4 cloves garlic, minced', '1 head garlic'],
		['3 large eggs', 'eggs'],
		['1 cup chopped cilantro', 'cilantro'],
		['1 tablespoon shaoxing wine', 'shaoxing wine'],
		['1 tablespoon spicy bean sauce', 'spicy bean sauce'],
		['1/8 teaspoon Ground white pepper', 'ground white pepper'],
		['¼ cup red pepper', 'red pepper'],
		['1 tbsp white miso', 'white miso'],
		['1 cup diced onions', 'onions'],
	])('buys %s as %s', (line, bought) => {
		expect(shoppingLine(line)).toBe(bought)
	})

	test.each([
		['2 onions, diced', '2 onions'],
		['1 lb chicken thighs', '1 lb chicken thighs'],
		['2 lb bone-in short ribs', '2 lb bone-in short ribs'],
		['1 (15-ounce) can chickpeas, rinsed', '1 (15-ounce) can chickpeas'],
		['1 large fish filet', '1 large fish filet'],
	])('keeps %s as the recipe needs it', (line, bought) => {
		expect(shoppingLine(line)).toBe(bought)
	})

	test('buys what two lines share once', () => {
		expect(groceryList(['1 tsp cumin', '2 tsp ground cumin', 'salt'])).toEqual([
			'cumin',
			'salt',
		])
	})
})
