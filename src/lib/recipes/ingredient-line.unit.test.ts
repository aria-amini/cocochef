import { describe, expect, test } from 'vite-plus/test'

import {
	formatIngredientHeading,
	ingredientHeading,
	ingredientSubject,
	parseIngredientLine,
	splitIngredientAmount,
	splitIngredientDetails,
} from './ingredient-line'

describe('ingredient details', () => {
	test.each([
		[
			'2/3 cup milk (at room temperature)',
			'2/3 cup milk',
			'(at room temperature)',
		],
		['1 egg (room temperature (~55g))', '1 egg', '(room temperature (~55g))'],
		[
			'1 (14 oz) can tomatoes (drained)',
			'1 (14 oz) can tomatoes (drained)',
			'',
		],
		['1 cup (240ml) milk', '1 cup (240ml) milk', ''],
		['1 onion (diced', '1 onion (diced', ''],
	])(
		'separates only unambiguous trailing detail in %s',
		(line, main, detail) => {
			expect(splitIngredientDetails(line)).toEqual({ main, detail })
		},
	)
})

describe('parseIngredientLine', () => {
	test.each([
		['200g pasta', { quantity: 200, unit: 'g', name: 'pasta' }],
		['1 tbsp miso', { quantity: 1, unit: 'tbsp', name: 'miso' }],
		[
			'3 Tablespoons balsamic vinegar',
			{ quantity: 3, unit: 'tbsp', name: 'balsamic vinegar' },
		],
		['1/2 cup olive oil', { quantity: 0.5, unit: 'cup', name: 'olive oil' }],
		['1 1/2 cups flour', { quantity: 1.5, unit: 'cup', name: 'flour' }],
		['1½ cups milk', { quantity: 1.5, unit: 'cup', name: 'milk' }],
		['½ onion', { quantity: 0.5, unit: '', name: 'onion' }],
		['2 onions', { quantity: 2, unit: '', name: 'onions' }],
		['2-3 eggs', { quantity: undefined, unit: '', name: '2-3 eggs' }],
		['100% cocoa', { quantity: undefined, unit: '', name: '100% cocoa' }],
		[
			'2 (14 oz) cans tomatoes',
			{ quantity: 2, unit: '', name: '(14 oz) cans tomatoes' },
		],
		['salt to taste', { quantity: undefined, unit: '', name: 'salt to taste' }],
	])('parses %s', (line, expected) => {
		expect(parseIngredientLine(line)).toEqual(expected)
	})
})

describe('splitIngredientAmount', () => {
	test.each([
		['200g pasta', { amount: '200 g', name: 'pasta' }],
		[
			'1 ½ tablespoons dried mint',
			{ amount: '1 ½ tablespoons', name: 'dried mint' },
		],
		['1 1/2 cups flour', { amount: '1 1/2 cups', name: 'flour' }],
		['2 large eggs', { amount: '2', name: 'large eggs' }],
		[
			'12oz / 340g fresh spinach',
			{ amount: '12 oz', name: 'fresh spinach · 340g' },
		],
		['1 cup / 240 ml milk', { amount: '1 cup', name: 'milk · 240 ml' }],
		['2 (14 oz) cans tomatoes', { amount: '2', name: '(14 oz) cans tomatoes' }],
		['2-3 eggs', { amount: '', name: '2-3 eggs' }],
		['salt to taste', { amount: '', name: 'salt to taste' }],
		['  ½ onion ', { amount: '½', name: 'onion' }],
	])('splits %s', (line, expected) => {
		expect(splitIngredientAmount(line)).toEqual(expected)
	})
})

describe('ingredient headings', () => {
	test.each([
		['## for the sauce', 'for the sauce'],
		['##   for the dough  ', 'for the dough'],
		['## ', undefined],
		['2 eggs', undefined],
		['#1 pick: salt', undefined],
	])('reads %j as %j', (line, heading) => {
		expect(ingredientHeading(line)).toBe(heading)
	})

	test('formats a heading, dropping an empty one', () => {
		expect(formatIngredientHeading(' for the sauce ')).toBe('## for the sauce')
		expect(formatIngredientHeading('  ')).toBe('')
	})
})

describe('ingredient subject', () => {
	test.each([
		['1 cup (240ml) milk', 'milk'],
		['1 and 1/2 cups (300g) granulated sugar', 'granulated sugar'],
		[
			'10 Tablespoons (142g) unsalted butter, slightly soft',
			'unsalted butter, slightly soft',
		],
		['1 (15-ounce) can chickpeas, rinsed', 'chickpeas, rinsed'],
		['1 large can (28 ounces) diced tomatoes', 'diced tomatoes'],
		['1 cup plus 2 tbsp. (155g) all-purpose flour', 'all-purpose flour'],
		[
			'1½ cups (188 g) all-purpose flour, plus more for pan',
			'all-purpose flour, plus more for pan',
		],
		['2 tbsp chopped parsley', 'chopped parsley'],
		['salt, to taste', 'salt, to taste'],
		['2 large eggs', 'eggs'],
		['1 cup / 240 ml orange juice', 'orange juice'],
		['12oz / 340g fresh spinach', 'fresh spinach'],
		['1 stick unsalted butter', 'unsalted butter'],
		[
			'4 boneless, skinless chicken breasts, trimmed',
			'chicken breasts, trimmed',
		],
	])('finds the food in %s', (line, expected) => {
		expect(ingredientSubject(line)).toBe(expected)
	})

	test('keeps a literal middle dot in the food name', () => {
		expect(ingredientSubject('1 cup crème · fraîche')).toBe('crème · fraîche')
	})

	test('never strips a line to nothing', () => {
		expect(ingredientSubject('1 cup')).toBe('1 cup')
		expect(ingredientSubject('')).toBe('')
	})
})
