import { categoryKey } from './catalog'
import type { PantryCategory } from './model'

// What a food is, finer than the aisle it is bought in: the pantry shelves
// food by kind, as a cook does, while the grocery list keeps to aisles.
// Each kind sits on one shelf, and each shelf in one place: the
// refrigerator, fridge or freezer, or the pantry proper. Shelves run in the order a cook
// looks: what spoils first, spices last. A food added to a shelf that
// nothing recognizes is bought in the shelf's aisle.
const otherShelf = {
	id: 'other',
	place: 'pantry',
	aisle: 'other',
	label: 'other',
	kinds: ['other'],
} as const

export const pantryShelves = [
	{
		id: 'fridge',
		place: 'refrigerator',
		aisle: 'dairy',
		label: 'fridge',
		kinds: ['dairy & eggs', 'meat & seafood', 'produce'],
	},
	{
		id: 'freezer',
		place: 'refrigerator',
		aisle: 'frozen',
		label: 'freezer',
		kinds: ['frozen'],
	},
	{
		id: 'sauces',
		place: 'pantry',
		aisle: 'sauces',
		label: 'oils & sauces',
		kinds: ['oils', 'vinegars', 'sauces', 'condiments'],
	},
	{
		id: 'dry',
		place: 'pantry',
		aisle: 'grains',
		label: 'dry goods',
		kinds: [
			'rice',
			'pasta & noodles',
			'grains',
			'beans & lentils',
			'flours',
			'sugar & sweeteners',
			'baking',
			'nuts & dried fruit',
			'bread',
			'snacks',
			'coffee & tea',
		],
	},
	{
		id: 'cans',
		place: 'pantry',
		aisle: 'cans',
		label: 'cans & jars',
		kinds: ['tomatoes', 'stocks', 'cans & jars'],
	},
	{
		id: 'spices',
		place: 'pantry',
		aisle: 'spices',
		label: 'spices',
		kinds: ['spices'],
	},
	otherShelf,
] as const

export const pantryPlaces = ['refrigerator', 'pantry'] as const

export type PantryShelf = (typeof pantryShelves)[number]

export type PantryKind = PantryShelf['kinds'][number]

// Words that give a shelf-stable food's kind, singular, as `categoryKey`
// leaves them. The first kind with a match wins, so the narrow come first:
// rice noodles are noodles and rice vinegar is vinegar, not rice.
const kindWords: [PantryKind, string[]][] = [
	['vinegars', ['vinegar']],
	['oils', ['oil', 'ghee', 'shortening']],
	['stocks', ['broth', 'stock', 'bouillon']],
	[
		'pasta & noodles',
		[
			'pasta',
			'spaghetti',
			'noodle',
			'macaroni',
			'penne',
			'linguine',
			'fettuccine',
			'orzo',
			'lasagna',
			'ramen',
			'udon',
			'soba',
			'rigatoni',
			'fusilli',
			'farfalle',
			'vermicelli',
		],
	],
	['rice', ['rice']],
	['flours', ['flour', 'cornmeal', 'cornstarch', 'semolina', 'starch']],
	['sugar & sweeteners', ['sugar', 'honey', 'syrup', 'molasses', 'agave']],
	[
		'baking',
		[
			'baking soda',
			'baking powder',
			'yeast',
			'cocoa',
			'chocolate',
			'vanilla',
			'sprinkle',
			'gelatin',
		],
	],
	[
		'nuts & dried fruit',
		[
			'nut',
			'almond',
			'walnut',
			'peanut',
			'cashew',
			'pecan',
			'pistachio',
			'hazelnut',
			'seed',
			'raisin',
			'dried fruit',
			'date',
			'trail mix',
		],
	],
	[
		'beans & lentils',
		['bean', 'lentil', 'chickpea', 'split pea', 'black eyed pea'],
	],
	['tomatoes', ['tomato']],
	[
		'condiments',
		[
			'ketchup',
			'mustard',
			'dijon',
			'mayonnaise',
			'mayo',
			'hot sauce',
			'sriracha',
			'relish',
			'jam',
			'jelly',
		],
	],
	[
		'grains',
		[
			'oat',
			'quinoa',
			'couscous',
			'barley',
			'farro',
			'bulgur',
			'breadcrumb',
			'panko',
			'cereal',
			'granola',
			'polenta',
		],
	],
	['bread', ['bread', 'tortilla', 'pita', 'bagel']],
	['snacks', ['chip', 'cracker', 'pretzel', 'popcorn']],
	['coffee & tea', ['coffee', 'tea', 'espresso']],
]

// Fresh aisles name their kind outright; shelf-stable ones are read from
// the food's name, falling back to what the aisle mostly holds.
const kindOfAisle: Record<PantryCategory, PantryKind> = {
	spices: 'spices',
	meat: 'meat & seafood',
	dairy: 'dairy & eggs',
	vegetables: 'produce',
	fruit: 'produce',
	frozen: 'frozen',
	grains: 'grains',
	cans: 'cans & jars',
	sauces: 'sauces',
	other: 'other',
}

const namedAisles = new Set<PantryCategory>([
	'spices',
	'meat',
	'dairy',
	'vegetables',
	'fruit',
	'frozen',
])

export function kindOf(name: string, category: PantryCategory): PantryKind {
	if (namedAisles.has(category)) return kindOfAisle[category]

	const words = ` ${categoryKey(name)} `

	for (const [kind, keys] of kindWords)
		if (keys.some((key) => words.includes(` ${key} `))) return kind

	return kindOfAisle[category]
}

// Food with more than two weeks left is a staple: looked up, not used up,
// and kept on shelves by kind rather than on the pantry's timeline.
export const keepsAWhile = (item: { daysLeft: number }) => item.daysLeft > 14

// The shelf a food sits on, by its kind.
export function shelfOf(name: string, category: PantryCategory): PantryShelf {
	const kind = kindOf(name, category)

	return (
		pantryShelves.find((shelf) =>
			shelf.kinds.some((each: PantryKind) => each === kind),
		) ?? otherShelf
	)
}

// Where a kept food sits: frozen, it's in the freezer whatever it is.
export function shelfOfItem(item: {
	name: string
	category: PantryCategory
	frozenAt?: Date | null
}): PantryShelf {
	return item.frozenAt
		? (pantryShelves.find((shelf) => shelf.id === 'freezer') ?? otherShelf)
		: shelfOf(item.name, item.category)
}

// Where an aisle's food mostly sits, for old links that named an aisle.
export const shelfOfAisle = (category: PantryCategory) =>
	shelfOf('', category).id

// Kinds in shelf order, so a shelf's food sorts kind by kind.
export const kindOrder = new Map<PantryKind, number>(
	pantryShelves
		.flatMap((shelf) => [...shelf.kinds])
		.map((kind, at) => [kind, at]),
)
