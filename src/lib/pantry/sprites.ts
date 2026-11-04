import { z } from 'zod'

import type { PantryCategory } from './model'

const spriteCategory = z.enum([
	'vegetable',
	'fruit',
	'dairy',
	'grain',
	'protein',
	'spice',
	'other',
])

type SpriteCategory = z.infer<typeof spriteCategory>

type SpriteEntry = {
	key: string
	category: SpriteCategory
	aliases: string[]
}

const sprite = <const Key extends string>(
	key: Key,
	category: SpriteCategory,
	aliases: string[],
) => ({ key, category, aliases }) satisfies SpriteEntry

export const pantrySprites = [
	sprite('apple', 'fruit', ['apple', 'apples']),
	sprite('avocado', 'fruit', ['avocado', 'avocados']),
	sprite('bacon', 'protein', ['bacon', 'pancetta']),
	sprite('banana', 'fruit', ['banana', 'bananas']),
	sprite('bell-pepper', 'vegetable', ['bell pepper', 'bell peppers']),
	sprite('black-pepper', 'spice', [
		'black pepper',
		'peppercorns',
		'peppercorn',
	]),
	sprite('blueberries', 'fruit', ['blueberry', 'blueberries']),
	sprite('bread', 'grain', ['bread', 'loaf', 'rolls', 'buns']),
	sprite('broccoli', 'vegetable', ['broccoli']),
	sprite('butter', 'dairy', ['butter']),
	sprite('carrot', 'vegetable', ['carrot', 'carrots']),
	sprite('cheese', 'dairy', [
		'cheese',
		'cheddar',
		'parmesan',
		'mozzarella',
		'feta',
		'gouda',
		'brie',
		'gruyere',
	]),
	sprite('cherry', 'fruit', ['cherry', 'cherries']),
	sprite('chicken', 'protein', [
		'chicken',
		'drumstick',
		'drumsticks',
		'thighs',
		'wings',
	]),
	sprite('chili-pepper', 'spice', [
		'chili',
		'chile',
		'chili pepper',
		'hot pepper',
		'red pepper flakes',
	]),
	sprite('chocolate', 'other', ['chocolate', 'cocoa']),
	sprite('cinnamon', 'spice', ['cinnamon']),
	sprite('coffee-beans', 'other', ['coffee', 'coffee beans', 'espresso']),
	sprite('corn', 'vegetable', ['corn', 'cornmeal', 'polenta']),
	sprite('cucumber', 'vegetable', [
		'cucumber',
		'cucumbers',
		'pickle',
		'pickles',
	]),
	sprite('egg', 'protein', ['egg', 'eggs']),
	sprite('eggplant', 'vegetable', ['eggplant', 'aubergine']),
	sprite('fish', 'protein', [
		'fish',
		'cod',
		'tilapia',
		'tuna',
		'trout',
		'halibut',
		'sea bass',
	]),
	sprite('flour', 'grain', ['flour', 'all purpose flour', 'bread flour']),
	sprite('garlic', 'vegetable', ['garlic', 'garlic cloves']),
	sprite('grapes', 'fruit', ['grape', 'grapes', 'raisins']),
	sprite('honey', 'other', ['honey', 'maple syrup', 'syrup', 'agave']),
	sprite('jalapeno', 'spice', ['jalapeno', 'jalapeño', 'serrano', 'habanero']),
	sprite('kale', 'vegetable', [
		'kale',
		'chard',
		'collard greens',
		'collards',
		'spinach',
	]),
	sprite('lemon', 'fruit', ['lemon', 'lemons', 'lime', 'limes']),
	sprite('lettuce', 'vegetable', [
		'lettuce',
		'romaine',
		'arugula',
		'greens',
		'salad greens',
		'iceberg',
	]),
	sprite('mango', 'fruit', ['mango', 'mangoes']),
	sprite('meat', 'protein', [
		'beef',
		'ground beef',
		'pork',
		'lamb',
		'meat',
		'mince',
		'ground pork',
		'ground turkey',
	]),
	sprite('milk', 'dairy', [
		'milk',
		'cream',
		'heavy cream',
		'half and half',
		'buttermilk',
		'yogurt',
		'yoghurt',
		'sour cream',
		'creme fraiche',
	]),
	sprite('mushroom', 'vegetable', [
		'mushroom',
		'mushrooms',
		'shiitake',
		'cremini',
		'portobello',
		'button mushrooms',
	]),
	sprite('mustard', 'spice', ['mustard', 'dijon', 'whole grain mustard']),
	sprite('nuts', 'other', [
		'nuts',
		'almonds',
		'walnuts',
		'pecans',
		'cashews',
		'peanuts',
		'pistachios',
		'pine nuts',
		'hazelnuts',
	]),
	sprite('olive-oil', 'other', [
		'olive oil',
		'oil',
		'vegetable oil',
		'canola oil',
		'sesame oil',
		'avocado oil',
	]),
	sprite('olives', 'vegetable', ['olive', 'olives', 'kalamata']),
	sprite('onion', 'vegetable', [
		'onion',
		'onions',
		'shallot',
		'shallots',
		'red onion',
		'yellow onion',
		'scallion',
		'scallions',
		'spring onion',
		'leek',
		'leeks',
	]),
	sprite('orange', 'fruit', [
		'orange',
		'oranges',
		'tangerine',
		'clementine',
		'mandarin',
	]),
	sprite('peach', 'fruit', [
		'peach',
		'peaches',
		'nectarine',
		'apricot',
		'apricots',
	]),
	sprite('pear', 'fruit', ['pear', 'pears']),
	sprite('peas', 'vegetable', ['peas', 'green peas', 'snap peas', 'snow peas']),
	sprite('pie', 'grain', [
		'pie',
		'pastry',
		'tart',
		'cake',
		'cookie',
		'cookies',
		'brownie',
		'brownies',
	]),
	sprite('pineapple', 'fruit', ['pineapple']),
	sprite('potato', 'vegetable', [
		'potato',
		'potatoes',
		'sweet potato',
		'sweet potatoes',
		'yam',
		'yams',
	]),
	sprite('radish', 'vegetable', [
		'radish',
		'radishes',
		'turnip',
		'turnips',
		'beet',
		'beets',
	]),
	sprite('rice', 'grain', [
		'rice',
		'jasmine rice',
		'basmati',
		'risotto',
		'arborio',
	]),
	sprite('salmon', 'protein', ['salmon', 'lox', 'smoked salmon']),
	sprite('salt', 'spice', ['salt', 'sea salt', 'kosher salt', 'flaky salt']),
	sprite('sausage', 'protein', [
		'sausage',
		'sausages',
		'chorizo',
		'bratwurst',
		'kielbasa',
		'salami',
		'pepperoni',
		'ham',
		'prosciutto',
	]),
	sprite('steak', 'protein', [
		'steak',
		'ribeye',
		'sirloin',
		'filet',
		'brisket',
		'roast',
	]),
	sprite('strawberry', 'fruit', [
		'strawberry',
		'strawberries',
		'raspberry',
		'raspberries',
		'blackberry',
		'blackberries',
		'berry',
		'berries',
	]),
	sprite('tomato', 'vegetable', [
		'tomato',
		'tomatoes',
		'canned tomatoes',
		'passata',
		'tomato paste',
		'crushed tomatoes',
	]),
	sprite('watermelon', 'fruit', [
		'watermelon',
		'melon',
		'cantaloupe',
		'honeydew',
	]),
	sprite('wheat', 'grain', [
		'wheat',
		'oats',
		'oatmeal',
		'barley',
		'quinoa',
		'couscous',
		'pasta',
		'noodles',
		'spaghetti',
	]),
	sprite('zucchini', 'vegetable', [
		'zucchini',
		'courgette',
		'squash',
		'summer squash',
		'pumpkin',
		'butternut squash',
	]),
] as const

const spriteKeys = new Set<string>(pantrySprites.map((entry) => entry.key))

const fallbackKeys: Record<SpriteCategory, string> = {
	vegetable: 'fallback-vegetable',
	fruit: 'fallback-fruit',
	dairy: 'fallback-dairy',
	grain: 'fallback-grain',
	protein: 'fallback-protein',
	spice: 'fallback-spice',
	other: 'fallback-other',
}

const categoryKeywords: [SpriteCategory, string[]][] = [
	[
		'vegetable',
		[
			'vegetable',
			'veggies',
			'herbs',
			'parsley',
			'cilantro',
			'basil',
			'thyme',
			'rosemary',
			'oregano',
			'bay leaves',
			'celery',
			'asparagus',
			'artichoke',
			'fennel',
			'cauliflower',
			'brussels sprouts',
			'cabbage',
			'bok choy',
			'green beans',
		],
	],
	['fruit', ['fruit', 'jam', 'jelly', 'preserves', 'compote']],
	[
		'dairy',
		[
			'dairy',
			'ricotta',
			'halloumi',
			'paneer',
			'kefir',
			'evaporated milk',
			'condensed milk',
			'whipped cream',
			'ice cream',
		],
	],
	[
		'grain',
		[
			'grain',
			'cereal',
			'crackers',
			'tortilla',
			'pita',
			'bagel',
			'cereal',
			'granola',
			'breadcrumbs',
			'panko',
		],
	],
	[
		'protein',
		[
			'tofu',
			'tempeh',
			'beans',
			'lentils',
			'chickpeas',
			'shrimp',
			'prawns',
			'crab',
			'lobster',
			'scallops',
			'mussels',
			'clams',
			'duck',
			'turkey',
			'veal',
			'jerky',
		],
	],
	[
		'spice',
		[
			'spice',
			'seasoning',
			'cumin',
			'paprika',
			'turmeric',
			'cardamom',
			'cloves',
			'nutmeg',
			'allspice',
			'coriander',
			'fennel seeds',
			'bay',
			'curry',
			'ginger',
			'saffron',
			'vanilla',
			'extract',
		],
	],
	[
		'other',
		[
			'sauce',
			'soy sauce',
			'vinegar',
			'ketchup',
			'hot sauce',
			'sriracha',
			'mayo',
			'mayonnaise',
			'broth',
			'stock',
			'wine',
			'beer',
			'juice',
			'soda',
			'tea',
			'sugar',
			'brown sugar',
			'baking soda',
			'baking powder',
			'yeast',
			'gelatin',
			'coconut milk',
			'coconut cream',
			'tahini',
			'peanut butter',
			'almond butter',
		],
	],
]

const categoryFallbacks: Partial<Record<PantryCategory, SpriteCategory>> = {
	spices: 'spice',
	meat: 'protein',
	dairy: 'dairy',
	vegetables: 'vegetable',
	fruit: 'fruit',
	grains: 'grain',
}

export function resolveSpriteSrc(
	name: string,
	spriteKey?: string | null,
	category?: PantryCategory,
): string {
	if (
		spriteKey &&
		(spriteKeys.has(spriteKey) ||
			Object.values(fallbackKeys).includes(spriteKey))
	) {
		return `/sprites/pantry/${spriteKey}.png`
	}

	const normalized = ` ${normalizeName(name)} `

	const match = spriteMatches.find(({ alias }) =>
		normalized.includes(` ${alias} `),
	)

	// A known category beats a keyword guess, but not a specific sprite.
	const fallback = category && categoryFallbacks[category]

	const key =
		match && !match.guess
			? match.key
			: fallback
				? fallbackKeys[fallback]
				: (match?.key ?? fallbackKeys.other)

	return `/sprites/pantry/${key}.png`
}

// The sprite an ingredient has of its own, when it has one; a guess from a
// keyword ("frozen shrimp" is some protein) doesn't count.
export function specificSpriteKey(name: string) {
	const normalized = ` ${normalizeName(name)} `

	const match = spriteMatches.find(({ alias }) =>
		normalized.includes(` ${alias} `),
	)

	return match && !match.guess ? match.key : undefined
}

const ingredientItemPatterns = pantrySprites
	.map(({ key }) => ({
		key,
		pattern: new RegExp(`(?:^| )${key.replaceAll('-', ' ')}s?(?: |$)`),
	}))
	.sort((a, b) => b.key.length - a.key.length)

// Item icons must depict the named food, not a related food used as a category
// stand-in (for example, the lemon sprite must never represent a lime).
export function ingredientItemSprite(name: string) {
	const main = normalizeName(name.split(/[,;(]/, 1)[0] ?? '')

	if (/\b(?:ground beef|beef mince)\b/.test(main)) return 'meat'

	const match = ingredientItemPatterns.find(({ pattern }) => pattern.test(main))

	if (!match) return undefined

	// These are ingredients in their own right, not the food pictured by a
	// shorter match inside their name.
	if (/\b(?:egg noodles|coconut milk|garlic powder|onion powder)\b/.test(main))
		return undefined

	return match.key
}

function normalizeName(name: string) {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
}

const spriteMatches = [
	...pantrySprites.flatMap(({ key, aliases }) =>
		aliases.map((alias) => ({
			key,
			alias: normalizeName(alias),
			guess: false,
		})),
	),
	...categoryKeywords.flatMap(([category, keywords]) =>
		keywords.map((alias) => ({
			key: fallbackKeys[category],
			alias: normalizeName(alias),
			guess: true,
		})),
	),
].sort((a, b) => b.alias.length - a.alias.length)
