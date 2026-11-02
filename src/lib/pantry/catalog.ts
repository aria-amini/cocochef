import { z } from 'zod'

import { foodFamily } from './food-family'
import type { PantryCategory } from './model'
import { pantrySprites } from './sprites'

export const categorySprites: Record<PantryCategory, string> = {
	spices: 'cinnamon',
	meat: 'meat',
	dairy: 'milk',
	vegetables: 'carrot',
	fruit: 'apple',
	grains: 'flour',
	cans: 'tomato',
	sauces: 'olive-oil',
	frozen: 'ice-cube',
	other: 'fallback-other',
}

const section = <const Id extends PantryCategory>(id: Id, items: string[]) => ({
	id,
	items,
})

// Staples a cook can tap through to stock a kitchen in one pass.
export const catalogSections = [
	section('spices', [
		'salt',
		'black pepper',
		'garlic powder',
		'onion powder',
		'paprika',
		'smoked paprika',
		'cumin',
		'chili powder',
		'cayenne',
		'red pepper flakes',
		'oregano',
		'dried basil',
		'thyme',
		'rosemary',
		'sage',
		'dill',
		'bay leaves',
		'italian seasoning',
		'cinnamon',
		'nutmeg',
		'ground ginger',
		'turmeric',
		'coriander',
		'cardamom',
		'cloves',
		'allspice',
		'curry powder',
		'garam masala',
		'chinese five spice',
		'star anise',
		'fennel seeds',
		'mustard seeds',
		'sesame seeds',
		'cajun seasoning',
		'everything bagel seasoning',
		"za'atar",
		'sumac',
		'saffron',
		'vanilla extract',
	]),
	section('meat', [
		'chicken breast',
		'chicken thighs',
		'whole chicken',
		'chicken wings',
		'ground beef',
		'steak',
		'brisket',
		'pork chops',
		'pork shoulder',
		'ground pork',
		'ground turkey',
		'turkey breast',
		'lamb',
		'bacon',
		'sausage',
		'chorizo',
		'ham',
		'prosciutto',
		'salami',
		'hot dogs',
		'deli turkey',
		'salmon',
		'shrimp',
		'cod',
		'tuna steak',
		'tilapia',
		'scallops',
		'tofu',
		'tempeh',
	]),
	section('dairy', [
		'eggs',
		'milk',
		'butter',
		'heavy cream',
		'half and half',
		'buttermilk',
		'sour cream',
		'yogurt',
		'greek yogurt',
		'cream cheese',
		'cottage cheese',
		'ricotta',
		'cheddar',
		'mozzarella',
		'parmesan',
		'feta',
		'goat cheese',
		'swiss cheese',
		'brie',
		'gruyere',
		'oat milk',
		'almond milk',
	]),
	section('vegetables', [
		'onions',
		'red onion',
		'garlic',
		'shallots',
		'scallions',
		'potatoes',
		'sweet potatoes',
		'carrots',
		'celery',
		'bell peppers',
		'jalapeños',
		'tomatoes',
		'cherry tomatoes',
		'cucumbers',
		'zucchini',
		'eggplant',
		'mushrooms',
		'broccoli',
		'cauliflower',
		'cabbage',
		'brussels sprouts',
		'green beans',
		'asparagus',
		'corn',
		'peas',
		'spinach',
		'kale',
		'lettuce',
		'arugula',
		'avocados',
		'fresh ginger',
		'cilantro',
		'parsley',
		'fresh basil',
		'fresh thyme',
	]),
	section('fruit', [
		'apples',
		'bananas',
		'lemons',
		'limes',
		'oranges',
		'strawberries',
		'blueberries',
		'raspberries',
		'grapes',
		'cherries',
		'peaches',
		'pears',
		'pineapple',
		'mango',
		'watermelon',
		'kiwi',
		'raisins',
	]),
	section('grains', [
		'rice',
		'brown rice',
		'pasta',
		'spaghetti',
		'egg noodles',
		'rice noodles',
		'bread',
		'tortillas',
		'oats',
		'quinoa',
		'couscous',
		'crackers',
		'cereal',
		'breadcrumbs',
		'panko',
		'flour',
		'sugar',
		'brown sugar',
		'powdered sugar',
		'baking soda',
		'baking powder',
		'yeast',
		'cornstarch',
		'cocoa powder',
		'chocolate chips',
		'honey',
		'maple syrup',
	]),
	section('cans', [
		'canned tomatoes',
		'tomato paste',
		'tomato sauce',
		'black beans',
		'chickpeas',
		'kidney beans',
		'lentils',
		'chicken broth',
		'vegetable broth',
		'coconut milk',
		'canned tuna',
		'peanut butter',
		'almonds',
		'walnuts',
		'peanuts',
		'olives',
		'pickles',
	]),
	section('sauces', [
		'olive oil',
		'vegetable oil',
		'sesame oil',
		'soy sauce',
		'white vinegar',
		'balsamic vinegar',
		'red wine vinegar',
		'rice vinegar',
		'apple cider vinegar',
		'hot sauce',
		'sriracha',
		'ketchup',
		'mustard',
		'dijon',
		'mayonnaise',
		'worcestershire sauce',
		'fish sauce',
		'oyster sauce',
		'hoisin sauce',
		'bbq sauce',
		'salsa',
		'pesto',
		'tahini',
		'jam',
	]),
	section('frozen', [
		'frozen peas',
		'frozen corn',
		'frozen spinach',
		'frozen broccoli',
		'frozen berries',
		'frozen shrimp',
		'frozen fries',
		'frozen pizza',
		'dumplings',
		'puff pastry',
		'pie crust',
		'waffles',
		'ice cream',
		'ice',
	]),
	section('other', [
		'coffee',
		'tea',
		'cashews',
		'pecans',
		'dried fruit',
		'granola',
		'popcorn',
		'chips',
		'pretzels',
		'trail mix',
		'sprinkles',
		'protein powder',
		'gelatin',
	]),
] as const

export const catalogSectionId = z.enum(catalogSections.map((entry) => entry.id))

export function findCatalogSection(id: PantryCategory | undefined) {
	return catalogSections.find((entry) => entry.id === id)
}

export function normalizeIngredientName(name: string) {
	return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Search ignores accents and apostrophes: "jalapeno" finds jalapeños.
function searchKey(text: string) {
	return normalizeIngredientName(text)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/['’]/g, '')
}

// Matches every word of the query against the start of a word in the name.
export function filterCatalogItems(items: readonly string[], query: string) {
	const words = searchKey(query).split(' ').filter(Boolean)

	if (words.length === 0) return [...items]

	return items.filter((item) => {
		const itemWords = searchKey(item).split(' ')

		return words.every((word) =>
			itemWords.some((itemWord) => itemWord.startsWith(word)),
		)
	})
}

// Shared food recognition uses the same category assignments as Ingredients,
// plus the existing food aliases. Match whole words and prefer the most
// specific food: coconut milk beats milk, tomato paste beats tomato.
function categoryKey(name: string) {
	return normalizeIngredientName(name)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.split(/\s+/)
		.map((word) =>
			word.endsWith('ies')
				? `${word.slice(0, -3)}y`
				: word.endsWith('oes')
					? word.slice(0, -2)
					: word.endsWith('s') && !word.endsWith('ss')
						? word.slice(0, -1)
						: word,
		)
		.join(' ')
}

const catalogCategories = new Map(
	catalogSections.flatMap(({ id, items }) =>
		items.map((name) => [categoryKey(name), id] as const),
	),
)

const spriteCategories: Record<
	(typeof pantrySprites)[number]['category'],
	PantryCategory
> = {
	vegetable: 'vegetables',
	fruit: 'fruit',
	dairy: 'dairy',
	grain: 'grains',
	protein: 'meat',
	spice: 'spices',
	other: 'other',
}

const categoryMatches = [
	...[...catalogCategories.entries()].map(([name, category]) => ({
		name,
		category,
	})),
	...pantrySprites.flatMap(({ aliases, category }) => {
		const names = aliases.map(categoryKey)

		const assigned =
			names
				.map((name) => catalogCategories.get(name))
				.find((value) => value !== undefined) ?? spriteCategories[category]

		return names.map((name) => ({
			name,
			category: catalogCategories.get(name) ?? assigned,
		}))
	}),
].sort((a, b) => b.name.length - a.name.length)

export function categorizeIngredient(name: string): PantryCategory {
	const normalized = ` ${categoryKey(name.replace(/\bcans?\b/gi, 'canned').replace(/\b(crushed|chopped|diced|minced|finely|coarsely|sliced|grated|shredded)\b/gi, ''))} `

	return (
		categoryMatches.find((match) => normalized.includes(` ${match.name} `))
			?.category ??
		foodFamily(name)?.category ??
		'other'
	)
}
