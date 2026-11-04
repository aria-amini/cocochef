import { z } from 'zod'

import { foodFamily } from './food-family'
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

// Compound foods take priority over the shorter food names inside them.
// These are deliberately shared family pictures rather than exact depictions.
const ingredientFamilySprites = [
	[
		'fallback-other',
		/\b(?:broth|stock|bouillon|consomme|sauce|vinegar|ketchup|sriracha|mayonnaise|mayo|tahini|pesto|salsa|jam|jelly|gelatin|extract|peanut butter|almond butter|coconut milk|coconut cream)\b/,
	],
	['olive-oil', /\b(?:oil|oils)\b/],
	[
		'fallback-spice',
		/\b(?:garlic powder|onion powder|mustard seeds?|sesame seeds?|chili powder|chilli powder|cayenne|garam masala|za atar|sumac|seasoning|five spice)\b/,
	],
	[
		'wheat',
		/\b(?:pasta|spaghetti|noodles|linguine|fettuccine|penne|macaroni|orzo|lasagne|lasagna)\b/,
	],
	['bread', /\b(?:breadcrumbs|panko|tortillas?|pita|bagels?)\b/],
	[
		'flour',
		/\b(?:sugar|cornstarch|corn starch|baking powder|baking soda|bicarbonate|yeast)\b/,
	],
	['milk', /\b(?:cream|yogurt|yoghurt|buttermilk|half and half|kefir)\b/],
	['cheese', /\b(?:ricotta|halloumi|paneer)\b/],
	[
		'meat',
		/\b(?:beef|pork|lamb|mutton|brisket|mince|turkey|duck|goose|venison|rabbit|veal)\b/,
	],
	['sausage', /\b(?:hot dogs?|frankfurters?)\b/],
	['fallback-vegetable', /\b(?:green beans|runner beans|string beans)\b/],
	[
		'fallback-protein',
		/\b(?:tofu|tempeh|beans?|lentils?|chickpeas?|garbanzo)\b/,
	],
	[
		'kale',
		/\b(?:coriander (?:leaves|leaf)|(?:fresh|chopped) coriander|coriander to serve|celery leaves)\b/,
	],
	[
		'fallback-vegetable',
		/\b(?:fresh ginger|ginger root|celery|cauliflower|cabbage|brussels sprouts|green beans|asparagus|fennel bulb)\b/,
	],
	['grapes', /\b(?:sultanas?|currants?)\b/],
	['ice-cube', /\b(?:ice|water)\b/],
] as const

// Recipe rows accept familiar family stand-ins: leafy greens for herbs, meat
// for pork/lamb, and fish for seafood. Unknown foods still leave the slot empty.
export function ingredientItemSprite(name: string) {
	const main = normalizeName(name.split(/[,;(]/, 1)[0] ?? '')

	if (!main || name.trimStart().startsWith('#')) return undefined

	const familySprite = ingredientFamilySprites.find(([, pattern]) =>
		pattern.test(main),
	)

	if (familySprite) return familySprite[0]

	const family = foodFamily(main)

	if (family?.id === 'herb') return 'kale'

	const normalized = ` ${singularIngredientWords(main)} `

	const match = ingredientMatches.find(({ alias }) =>
		normalized.includes(` ${alias} `),
	)

	if (match && !match.guess) return match.key

	if (family?.id === 'fish') return 'fish'

	if (family?.id === 'meat') return 'meat'

	if (family?.id === 'grain') return 'wheat'

	if (family?.id === 'seed') return 'fallback-grain'

	return match?.key
}

function singularIngredientWords(name: string) {
	return name
		.split(' ')
		.map((word) => {
			if (word.endsWith('ies')) return `${word.slice(0, -3)}y`

			if (word.endsWith('oes')) return word.slice(0, -2)

			if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)

			return word
		})
		.join(' ')
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

const ingredientMatches = spriteMatches
	.map((match) => ({ ...match, alias: singularIngredientWords(match.alias) }))
	.sort((a, b) => b.alias.length - a.alias.length)
