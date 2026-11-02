import { describe, expect, test } from 'vite-plus/test'

import {
	formatIngredientHeading,
	ingredientHeading,
	parseIngredientLine,
} from './ingredient-line'

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
