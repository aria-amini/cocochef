import { describe, expect, test } from 'vitest'

import { mockRegroup } from './regroup'

const tikka = {
	ingredients: [
		'1 lb chicken thighs',
		'1 cup plain yogurt',
		'1 tbsp lemon juice',
		'2 tsp garam masala',
		'1 tsp turmeric',
		'1 tsp salt',
		'2 tbsp butter',
		'1 onion, diced',
		'4 cloves garlic, grated',
		'1 tbsp grated ginger',
		'2 tsp garam masala',
		'1 tsp chili powder',
		'1 can crushed tomatoes',
		'1 cup heavy cream',
		'fresh cilantro',
		'cooked basmati rice',
		'naan',
	],
	steps: [
		'Mix the yogurt, lemon juice, garam masala, turmeric and salt, and marinate the chicken in it for 30 minutes.',
		'Grill the chicken until charred at the edges.',
		'For the sauce, melt the butter and soften the onion. Add the garlic, ginger, garam masala and chili powder.',
		'Add the tomatoes and simmer for 15 minutes, then stir in the cream and the chicken.',
		'Serve over rice with naan, scattered with cilantro.',
	],
}

describe('mockRegroup', () => {
	test('groups a flat list by the steps its foods go into', () => {
		expect(mockRegroup(tikka).groups).toEqual([
			{ heading: 'for the marinade', step: 0, lines: [0, 1, 2, 3, 4, 5] },
			{
				heading: 'for the sauce',
				step: 2,
				lines: [6, 7, 8, 9, 10, 11, 12, 13],
			},
			{ heading: 'to serve', step: 4, lines: [14, 15, 16] },
		])
	})

	test('leaves what goes in before any named group ungrouped', () => {
		const { groups } = mockRegroup({
			ingredients: [
				'200 g spaghetti',
				'salt for the water',
				'2 tbsp white miso',
				'3 tbsp butter',
				'## to serve',
				'30 g parmesan',
			],
			steps: [
				'Boil the spaghetti in well salted water.',
				'For the sauce, melt the butter with the miso.',
				'Toss the pasta through the sauce and top with parmesan.',
			],
		})

		expect(groups).toEqual([
			{ heading: null, step: 0, lines: [0, 1] },
			{ heading: 'for the sauce', step: 1, lines: [2, 3] },
			{ heading: 'to serve', step: 2, lines: [5] },
		])
	})

	test('offers nothing when no step names a group', () => {
		expect(
			mockRegroup({
				ingredients: ['## dry', '2 cups flour', '## wet', '2 eggs'],
				steps: ['Whisk the dry ingredients.', 'Fold in the eggs.'],
			}).groups,
		).toEqual([])
	})

	test('offers nothing without steps', () => {
		expect(mockRegroup({ ...tikka, steps: [] }).groups).toEqual([])
	})
})
