import { describe, expect, test } from 'vite-plus/test'

import { isPastedRecipe, parsePastedRecipe, pastedIngredients } from './paste'

describe('parsePastedRecipe', () => {
	test('splits on ingredients and method headings', () => {
		expect(
			parsePastedRecipe(`Nonna's ragù

Ingredients
- 500g beef mince
- 1 onion
For the soffritto:
- 2 carrots

Method
1. Brown the mince.
2) Add the onion and cook until soft.`),
		).toEqual({
			title: "Nonna's ragù",
			ingredients: [
				'500g beef mince',
				'1 onion',
				'## For the soffritto',
				'2 carrots',
			],
			steps: ['Brown the mince.', 'Add the onion and cook until soft.'],
		})
	})

	test('sorts lines by shape when there are no headings', () => {
		expect(
			parsePastedRecipe(`weeknight dal
1 cup red lentils
1 tbsp ghee
salt
Rinse the lentils and simmer them in 3 cups of water for 20 minutes.
Stir in the ghee and season.`),
		).toEqual({
			title: 'weeknight dal',
			ingredients: ['1 cup red lentils', '1 tbsp ghee', 'salt'],
			steps: [
				'Rinse the lentils and simmer them in 3 cups of water for 20 minutes.',
				'Stir in the ghee and season.',
			],
		})
	})

	test('leaves the name empty when the paste starts with a heading', () => {
		expect(parsePastedRecipe('ingredients\n2 eggs\nsteps\nwhisk')).toEqual({
			title: '',
			ingredients: ['2 eggs'],
			steps: ['whisk'],
		})
	})

	test('clamps a long first line to the title limit', () => {
		expect(parsePastedRecipe(`${'a'.repeat(200)}\n2 eggs`).title).toHaveLength(
			120,
		)
	})
})

test('isPastedRecipe needs more than one line', () => {
	expect(isPastedRecipe('dal')).toBe(false)
	expect(isPastedRecipe('  dal\n')).toBe(false)
	expect(isPastedRecipe('dal\n1 cup lentils')).toBe(true)
})

test('pastedIngredients keeps group labels as sections and drops bullets', () => {
	expect(
		pastedIngredients('- 2 cups flour\n\nfor the topping:\n• 1 tbsp sugar\n'),
	).toEqual(['2 cups flour', '## for the topping', '1 tbsp sugar'])
})
