import { describe, expect, test } from 'vite-plus/test'

import {
	abbreviateUnits,
	formatIngredientHeading,
	formatQuantity,
	setAmountUnit,
	stepAmount,
	ingredientHeading,
	ingredientSubject,
	parseIngredientLine,
	settleAmount,
	settledAmount,
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
		['1 ½ tablespoons dried mint', { amount: '1 ½ tbsp', name: 'dried mint' }],
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

describe('abbreviateUnits', () => {
	test('shows each measure in its short form', () => {
		expect(abbreviateUnits('2 tablespoons butter')).toBe('2 tbsp butter')
		expect(abbreviateUnits('1 Teaspoon salt')).toBe('1 tsp salt')
		expect(abbreviateUnits('8 ounces spaghetti')).toBe('8 oz spaghetti')
		expect(abbreviateUnits('2 lbs chicken')).toBe('2 lb chicken')
		expect(abbreviateUnits('200 grams flour')).toBe('200 g flour')
		expect(abbreviateUnits('½ Tbsp. honey')).toBe('½ tbsp honey')
		expect(abbreviateUnits('500 millilitres stock')).toBe('500 ml stock')
	})

	test('shortens a measure inside brackets and after a slash', () => {
		expect(abbreviateUnits('1 (15-ounce) can chickpeas')).toBe(
			'1 (15-oz) can chickpeas',
		)
		expect(abbreviateUnits('12 ounces / 340 grams spinach')).toBe(
			'12 oz / 340 g spinach',
		)
	})

	test('leaves words that are not measures alone', () => {
		expect(abbreviateUnits('pound the chicken thin')).toBe(
			'pound the chicken thin',
		)
		expect(abbreviateUnits('2 cups milk')).toBe('2 cups milk')
		expect(abbreviateUnits('3 cloves garlic')).toBe('3 cloves garlic')
	})
})

describe('settledAmount', () => {
	test('takes the amount once a space follows it', () => {
		expect(settledAmount('1 tbsp butter')).toBe('1 tbsp')
		expect(settledAmount('1 ½ tablespoons ')).toBe('1 ½ tablespoons')
		expect(settledAmount('2 eggs')).toBe('2')
		expect(settledAmount('1 tables')).toBe('1')
		expect(settledAmount('1 tables ')).toBe('1')
	})

	test('waits while the amount may still grow', () => {
		expect(settledAmount('1')).toBe(undefined)
		expect(settledAmount('12 g')).toBe(undefined)
		expect(settledAmount('a knob of butter')).toBe(undefined)
	})
})

describe('settleAmount', () => {
	test('shortens a settled measure as it is typed', () => {
		expect(settleAmount('1 tablespoon ')).toBe('1 tbsp ')
		expect(settleAmount('2 Teaspoons sugar')).toBe('2 tsp sugar')
		expect(settleAmount('1 tablespoon')).toBe('1 tablespoon')
		expect(settleAmount('2 cups flour')).toBe('2 cups flour')
	})
})

describe('formatQuantity', () => {
	test('writes shares as fractions', () => {
		expect(formatQuantity(1.5)).toBe('1 ½')
		expect(formatQuantity(0.25)).toBe('¼')
		expect(formatQuantity(2)).toBe('2')
		expect(formatQuantity(1 / 3)).toBe('⅓')
		expect(formatQuantity(0.4)).toBe('0.4')
	})
})

describe('stepAmount', () => {
	test('steps spoons by quarters below one and halves above', () => {
		expect(stepAmount('½ tsp salt', 1)).toBe('¾ tsp salt')
		expect(stepAmount('1 tbsp miso', 1)).toBe('1 ½ tbsp miso')
		expect(stepAmount('1 tbsp miso', -1)).toBe('¾ tbsp miso')
		expect(stepAmount('1 ⅓ tbsp honey', 1)).toBe('1 ½ tbsp honey')
	})

	test('steps weights, cups and whole things in their own sizes', () => {
		expect(stepAmount('200 g pasta', 1)).toBe('250 g pasta')
		expect(stepAmount('2 cups flour', 1)).toBe('2 ¼ cups flour')
		expect(stepAmount('2 cloves garlic', 1)).toBe('3 cloves garlic')
		expect(stepAmount('1 clove garlic', 1)).toBe('2 cloves garlic')
		expect(stepAmount('2 eggs', -1)).toBe('1 eggs')
	})

	test('never steps below the smallest step, and starts a bare line at 1', () => {
		expect(stepAmount('¼ tsp salt', -1)).toBe('¼ tsp salt')
		expect(stepAmount('garlic', 1)).toBe('1 garlic')
		expect(stepAmount('garlic', -1)).toBe('garlic')
	})
})

describe('setAmountUnit', () => {
	test('relabels the amount, keeping the number', () => {
		expect(setAmountUnit('1 tbsp miso', 'tsp')).toBe('1 tsp miso')
		expect(setAmountUnit('2 tablespoons butter', 'cup')).toBe('2 cups butter')
		expect(setAmountUnit('2 eggs', 'g')).toBe('2 g eggs')
	})

	test('takes the unit off when it is picked again', () => {
		expect(setAmountUnit('1 tbsp miso', 'tbsp')).toBe('1 miso')
	})
})
