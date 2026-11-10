import { describe, expect, test } from 'vite-plus/test'

import { mockAmounts, wantsAmount } from './amounts'

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
