import { describe, expect, test } from 'vite-plus/test'

import { amountsFromModel, mockAmounts, wantsAmount } from './amounts'

describe('wantsAmount', () => {
	test('takes a food written without an amount', () => {
		expect(wantsAmount('garlic')).toBe(true)
		expect(wantsAmount('fresh cilantro')).toBe(true)
	})

	test('skips amounts, headings, and foods that go by feel', () => {
		expect(wantsAmount('2 cloves garlic')).toBe(false)
		expect(wantsAmount('## sauce')).toBe(false)
		expect(wantsAmount('salt to taste')).toBe(false)
		expect(wantsAmount('')).toBe(false)
	})
})

describe('mockAmounts', () => {
	test('gives each line its usual amount, in order', () => {
		expect(
			mockAmounts({
				title: 'tikka masala',
				lines: [
					'garlic',
					'chicken thighs',
					'salt to taste',
					'saffron',
					'olive oil',
				],
			}).amounts,
		).toEqual(['3 cloves', '1 lb', null, null, '2 tbsp'])
	})
})

describe('amountsFromModel', () => {
	test('places each amount by line number, only where one is wanted', () => {
		expect(
			amountsFromModel(
				{
					title: 'tikka masala',
					lines: ['garlic', 'salt to taste', 'olive oil', 'saffron'],
				},
				{
					amounts: [
						{ line: 2, amount: ' 2 tbsp ' },
						{ line: 0, amount: '3 cloves' },
						{ line: 1, amount: '1 tsp' },
						{ line: 3, amount: 'a generous pinch of threads' },
						{ line: 9, amount: '1 cup' },
					],
				},
			).amounts,
		).toEqual(['3 cloves', null, '2 tbsp', null])
	})
})
