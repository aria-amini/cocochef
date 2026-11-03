import { describe, expect, test } from 'vite-plus/test'

import { ingredientItemSprite, resolveSpriteSrc } from './sprites'

describe('ingredient sprites', () => {
	test.each([
		['2 yellow onions, diced', 'onion'],
		['1 large egg', 'egg'],
		['500g beef mince', 'meat'],
		['1 lime', undefined],
		['raspberries', undefined],
		['coconut milk', undefined],
		['egg noodles', undefined],
		['1 cup broth (or milk)', undefined],
	])('uses an honest item icon for %s', (name, expected) => {
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
