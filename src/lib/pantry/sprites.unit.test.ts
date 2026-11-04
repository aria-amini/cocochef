import { describe, expect, test } from 'vite-plus/test'

import { ingredientItemSprite, resolveSpriteSrc } from './sprites'

describe('ingredient sprites', () => {
	test.each([
		['2 yellow onions, diced', 'onion'],
		['1 large egg', 'egg'],
		['400g plum tomatoes', 'tomato'],
		['2 potatoes', 'potato'],
		['cherries', 'cherry'],
		['2 tbsp chopped parsley', 'kale'],
		['handful chopped coriander to serve', 'kale'],
		['1 tsp ground coriander', 'fallback-spice'],
		['1 tsp garlic powder', 'fallback-spice'],
		['1 tsp yellow mustard seed', 'fallback-spice'],
		['1 chicken stock cube', 'fallback-other'],
		['2 tbsp fish sauce', 'fallback-other'],
		['1 tbsp coconut oil', 'olive-oil'],
		['250g Greek yogurt', 'milk'],
		['1 pork shoulder', 'meat'],
		['2 duck breasts', 'meat'],
		['2 turkey thighs', 'meat'],
		['200g green beans', 'fallback-vegetable'],
		['1 tsp dried thyme', 'kale'],
		['1 tbsp almond butter', 'fallback-other'],
		['200g prawns', 'fish'],
		['150g red lentils', 'fallback-protein'],
		['1cm fresh ginger', 'fallback-vegetable'],
		['25g toasted breadcrumbs', 'bread'],
		['1 tbsp brown sugar', 'flour'],
		['1 tbsp butter', 'butter'],
		['2 tbsp sultanas', 'grapes'],
		['a mystery ingredient', undefined],
		['', undefined],
		['## herbs', undefined],
		['500g beef mince', 'meat'],
		['1 lime', 'lemon'],
		['raspberries', 'strawberry'],
		['coconut milk', 'fallback-other'],
		['egg noodles', 'wheat'],
		['1 cup broth (or milk)', 'fallback-other'],
	])('uses a specific or familiar family icon for %s', (name, expected) => {
		expect(ingredientItemSprite(name)).toBe(expected)
	})
	test.each([
		['pineapple', 'pineapple'],
		['fresh green apples', 'apple'],
		['black pepper', 'black-pepper'],
		['peppercorns', 'black-pepper'],
		['eggplant', 'eggplant'],
		['coconut milk', 'fallback-other'],
		['peanut butter', 'fallback-other'],
		['red pepper flakes', 'chili-pepper'],
		['JALAPEÑO', 'jalapeno'],
		['frozen shrimp', 'fallback-protein'],
		['mystery ingredient', 'fallback-other'],
		['', 'fallback-other'],
	])('matches %s without partial-word collisions', (name, key) => {
		expect(resolveSpriteSrc(name)).toBe(`/sprites/pantry/${key}.png`)
	})

	test.each([
		['oregano', 'spices', 'fallback-spice'],
		['oregano', undefined, 'fallback-vegetable'],
		['peanut butter', 'cans', 'fallback-other'],
		['coconut milk', 'cans', 'fallback-other'],
		['cinnamon', 'spices', 'cinnamon'],
		['smoked paprika', 'spices', 'fallback-spice'],
		['white pepper', 'spices', 'fallback-spice'],
		['tofu', 'meat', 'fallback-protein'],
		['mystery jar', 'other', 'fallback-other'],
	] as const)('resolves %s in %s to %s', (name, category, key) => {
		expect(resolveSpriteSrc(name, null, category)).toBe(
			`/sprites/pantry/${key}.png`,
		)
	})

	test('honors only known explicit keys', () => {
		expect(resolveSpriteSrc('apple', 'banana')).toBe(
			'/sprites/pantry/banana.png',
		)
		expect(resolveSpriteSrc('apple', '../../secret')).toBe(
			'/sprites/pantry/apple.png',
		)
		expect(resolveSpriteSrc('apple', 'fallback-fruit')).toBe(
			'/sprites/pantry/fallback-fruit.png',
		)
	})
})
