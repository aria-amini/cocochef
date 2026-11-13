import { describe, expect, test } from 'vite-plus/test'

import {
	buyingAmount,
	setShoppingUnit,
	shoppingUnitsFor,
	stepShopping,
} from './amounts'

describe('shopping amounts', () => {
	test('steps whole things by one, never below one', () => {
		expect(stepShopping('2 limes', -1)).toBe('1 limes')
		expect(stepShopping('1 limes', -1)).toBe('1 limes')
		expect(stepShopping('milk', 1)).toBe('1 milk')
	})

	test('steps a weight by half a pound or fifty grams', () => {
		expect(stepShopping('2 lb chicken thighs', 1)).toBe('2 ½ lb chicken thighs')
		expect(stepShopping('500 g beef', -1)).toBe('450 g beef')
	})

	test('converts between weights, and starts over between kinds', () => {
		expect(setShoppingUnit('2 lb chicken thighs', 'g')).toBe(
			'900 g chicken thighs',
		)
		expect(setShoppingUnit('2 lb chicken thighs', 'pack')).toBe(
			'1 pack chicken thighs',
		)
		expect(setShoppingUnit('3 limes', 'each')).toBe('3 limes')
		expect(setShoppingUnit('2 lb limes', 'each')).toBe('1 limes')
	})

	test('turns a recipe measure into a way to buy it', () => {
		expect(stepShopping('2 tbsp butter', 1)).toBe('1 pack butter')
	})

	test('offers what each food is sold in', () => {
		expect(shoppingUnitsFor('eggs')).toEqual(['dozen', 'each'])
		expect(shoppingUnitsFor('2 limes')[0]).toBe('each')
		expect(shoppingUnitsFor('garlic')).toEqual(['head'])
	})
})

describe('buying amount', () => {
	test('turns a recipe measure into what a shop sells', () => {
		expect(buyingAmount('1/3 teaspoon ground cumin')).toEqual({
			name: 'cumin',
			amount: '1 jar',
		})
		expect(buyingAmount('2 tablespoons soy sauce')).toEqual({
			name: 'soy sauce',
			amount: '1 bottle',
		})
		expect(buyingAmount('3 cloves garlic, minced')).toEqual({
			name: 'garlic',
			amount: '1 head',
		})
	})

	test('keeps what fresh food needs, by weight or by count', () => {
		expect(buyingAmount('2 lb short ribs')).toEqual({
			name: 'short ribs',
			amount: '2 lb',
		})
		expect(buyingAmount('3 onions, diced')).toEqual({
			name: 'onions',
			amount: '3',
		})
	})
})
