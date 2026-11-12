// The parts of a meal, after Ethan Chlebowski's healthy home cooking
// framework: a flavor, a protein, and a form, with toppings to finish. A
// flavor belongs to a cuisine, so the two are one step: pick a cuisine, then
// one of its flavors if you like.
//
// Every recipe title is read for these parts by the words it uses ("cajun
// chicken tacos" is american south, cajun, chicken, tacos), so the finder can
// count what exists for each pick and never offer one that leads nowhere.

type Words = readonly string[]

type Part = { name: string; sprite: string; words: Words }

type Cuisine = Part & { flavors: readonly Part[] }

export const cuisineParts = [
	{
		name: 'korean',
		sprite: 'dried-chilies',
		words: ['korean', 'bibimbap', 'japchae', 'tteokbokki', 'kimbap', 'jjigae'],
		flavors: [
			{ name: 'gochujang', sprite: 'chili-pepper', words: ['gochujang'] },
			{ name: 'bulgogi', sprite: 'meat', words: ['bulgogi', 'galbi'] },
			{ name: 'kimchi', sprite: 'lettuce', words: ['kimchi'] },
		],
	},
	{
		name: 'japanese',
		sprite: 'rice',
		words: [
			'japanese',
			'ramen',
			'udon',
			'soba',
			'sushi',
			'donburi',
			'tempura',
			'yakitori',
			'okonomiyaki',
			'onigiri',
			'gyoza',
		],
		flavors: [
			{ name: 'teriyaki', sprite: 'honey', words: ['teriyaki'] },
			{ name: 'miso', sprite: 'beans', words: ['miso'] },
			{ name: 'katsu', sprite: 'bread', words: ['katsu', 'tonkatsu'] },
		],
	},
	{
		name: 'chinese',
		sprite: 'star-anise',
		words: [
			'chinese',
			'lo mein',
			'chow mein',
			'fried rice',
			'dumpling',
			'wonton',
			'mapo',
			'dan dan',
			'general tso',
			'orange chicken',
			'sesame chicken',
			'egg foo young',
			'bao',
		],
		flavors: [
			{
				name: 'sichuan',
				sprite: 'dried-chilies',
				words: ['sichuan', 'szechuan', 'kung pao', 'mapo', 'dan dan'],
			},
			{ name: 'hoisin', sprite: 'sauce', words: ['hoisin', 'char siu'] },
			{
				name: 'black bean',
				sprite: 'beans',
				words: ['black bean sauce'],
			},
		],
	},
	{
		name: 'thai',
		sprite: 'lemongrass',
		words: [
			'thai',
			'pad thai',
			'pad see ew',
			'larb',
			'tom yum',
			'tom kha',
			'massaman',
			'panang',
			'khao soi',
		],
		flavors: [
			{
				name: 'green curry',
				sprite: 'lemongrass',
				words: ['green curry'],
			},
			{ name: 'red curry', sprite: 'chili-pepper', words: ['red curry'] },
			{ name: 'peanut', sprite: 'nuts', words: ['peanut', 'satay'] },
		],
	},
	{
		name: 'vietnamese',
		sprite: 'lime',
		words: ['vietnamese', 'pho', 'banh mi', 'bun cha', 'nuoc cham'],
		flavors: [
			{
				name: 'lemongrass',
				sprite: 'lemongrass',
				words: ['lemongrass'],
			},
		],
	},
	{
		name: 'indian',
		sprite: 'cardamom-pods',
		words: [
			'indian',
			'dal',
			'dhal',
			'daal',
			'biryani',
			'saag',
			'paneer',
			'chana',
			'aloo',
			'naan',
			'butter chicken',
			'korma',
			'vindaloo',
			'jalfrezi',
			'rogan josh',
			'samosa',
		],
		flavors: [
			{ name: 'tandoori', sprite: 'chili-pepper', words: ['tandoori'] },
			{ name: 'tikka', sprite: 'tomato', words: ['tikka'] },
			{
				name: 'masala',
				sprite: 'cardamom-pods',
				words: ['masala', 'garam masala'],
			},
		],
	},
	{
		name: 'middle eastern',
		sprite: 'olives',
		words: [
			'middle eastern',
			'lebanese',
			'persian',
			'turkish',
			'israeli',
			'moroccan',
			'falafel',
			'hummus',
			'kebab',
			'kabob',
			'kofta',
			'shawarma',
			'shakshuka',
			'tagine',
			'fattoush',
			'tabbouleh',
		],
		flavors: [
			{ name: 'harissa', sprite: 'dried-chilies', words: ['harissa'] },
			{ name: "za'atar", sprite: 'seeds', words: ["za'atar", 'zaatar'] },
			{ name: 'tahini', sprite: 'seeds', words: ['tahini'] },
			{ name: 'shawarma', sprite: 'cinnamon', words: ['shawarma'] },
		],
	},
	{
		name: 'greek',
		sprite: 'olive-oil',
		words: [
			'greek',
			'souvlaki',
			'gyro',
			'moussaka',
			'spanakopita',
			'tzatziki',
			'mediterranean',
		],
		flavors: [
			{
				name: 'lemon herb',
				sprite: 'lemon',
				words: ['lemon herb', 'lemon oregano', 'lemon garlic'],
			},
			{ name: 'tzatziki', sprite: 'cucumber', words: ['tzatziki'] },
		],
	},
	{
		name: 'italian',
		sprite: 'tomato',
		words: [
			'italian',
			'risotto',
			'lasagna',
			'lasagne',
			'gnocchi',
			'bolognese',
			'cacciatore',
			'saltimbocca',
			'puttanesca',
			'arrabbiata',
			'cacio e pepe',
			'osso buco',
			'ragu',
			'minestrone',
			'focaccia',
			'pizza',
		],
		flavors: [
			{ name: 'pesto', sprite: 'garlic', words: ['pesto'] },
			{
				name: 'marinara',
				sprite: 'tomato',
				words: ['marinara', 'pomodoro', 'tomato sauce'],
			},
			{ name: 'piccata', sprite: 'lemon', words: ['piccata'] },
			{
				name: 'parmesan',
				sprite: 'cheese',
				words: ['parmesan', 'parmigiana', 'parm'],
			},
			{ name: 'carbonara', sprite: 'egg', words: ['carbonara'] },
		],
	},
	{
		name: 'mexican',
		sprite: 'chili-pepper',
		words: [
			'mexican',
			'enchilada',
			'quesadilla',
			'burrito',
			'fajita',
			'carnitas',
			'birria',
			'pozole',
			'tamale',
			'tostada',
			'chilaquiles',
			'elote',
			'tinga',
			'mole',
			'pico de gallo',
			'guacamole',
		],
		flavors: [
			{ name: 'chipotle', sprite: 'dried-chilies', words: ['chipotle'] },
			{ name: 'adobo', sprite: 'chili-pepper', words: ['adobo'] },
			{ name: 'al pastor', sprite: 'pineapple', words: ['al pastor'] },
			{
				name: 'salsa verde',
				sprite: 'lime',
				words: ['salsa verde', 'tomatillo'],
			},
			{
				name: 'chili lime',
				sprite: 'lime',
				words: ['chili lime', 'chile lime'],
			},
		],
	},
	{
		name: 'american south',
		sprite: 'corn',
		words: [
			'southern',
			'gumbo',
			'jambalaya',
			'etouffee',
			'po boy',
			'grits',
			'fried chicken',
			'hush puppies',
		],
		flavors: [
			{
				name: 'cajun',
				sprite: 'dried-chilies',
				words: ['cajun', 'creole', 'blackened'],
			},
			{
				name: 'barbecue',
				sprite: 'sauce',
				words: ['bbq', 'barbecue', 'barbecued'],
			},
			{ name: 'buffalo', sprite: 'chili-pepper', words: ['buffalo'] },
		],
	},
	{
		name: 'caribbean',
		sprite: 'mango',
		words: ['caribbean', 'jamaican', 'cuban', 'puerto rican', 'plantain'],
		flavors: [{ name: 'jerk', sprite: 'chili-pepper', words: ['jerk'] }],
	},
	{
		name: 'french',
		sprite: 'butter',
		words: [
			'french',
			'coq au vin',
			'ratatouille',
			'bourguignon',
			'provencal',
			'nicoise',
			'gratin',
			'quiche',
			'cassoulet',
			'bouillabaisse',
			'croque',
		],
		flavors: [
			{
				name: 'dijon',
				sprite: 'mustard',
				words: ['dijon', 'mustard'],
			},
			{
				name: 'garlic butter',
				sprite: 'garlic',
				words: ['garlic butter', 'beurre blanc', 'brown butter'],
			},
		],
	},
	{
		name: 'spanish',
		sprite: 'saffron',
		words: [
			'spanish',
			'paella',
			'gazpacho',
			'romesco',
			'patatas bravas',
			'tapas',
		],
		flavors: [
			{
				name: 'smoked paprika',
				sprite: 'dried-chilies',
				words: ['smoked paprika', 'chorizo'],
			},
		],
	},
] as const satisfies readonly Cuisine[]

export const proteinParts = [
	{
		name: 'chicken',
		sprite: 'chicken',
		words: ['chicken', 'drumstick', 'wings'],
	},
	{ name: 'turkey', sprite: 'chicken', words: ['turkey'] },
	{
		name: 'beef',
		sprite: 'steak',
		words: [
			'beef',
			'steak',
			'brisket',
			'short rib',
			'meatball',
			'bulgogi',
			'bolognese',
			'birria',
		],
	},
	{
		name: 'pork',
		sprite: 'bacon',
		words: [
			'pork',
			'bacon',
			'ham',
			'sausage',
			'chorizo',
			'carnitas',
			'pancetta',
			'prosciutto',
			'char siu',
			'al pastor',
			'tonkatsu',
		],
	},
	{ name: 'lamb', sprite: 'meat', words: ['lamb', 'mutton', 'kofta'] },
	{ name: 'salmon', sprite: 'salmon', words: ['salmon'] },
	{ name: 'tuna', sprite: 'fish', words: ['tuna'] },
	{ name: 'shrimp', sprite: 'shrimp', words: ['shrimp', 'prawn', 'prawns'] },
	{
		name: 'white fish',
		sprite: 'fish',
		words: [
			'cod',
			'halibut',
			'tilapia',
			'sea bass',
			'haddock',
			'snapper',
			'fish',
		],
	},
	{ name: 'tofu', sprite: 'tofu', words: ['tofu', 'tempeh'] },
	{
		name: 'eggs',
		sprite: 'egg',
		words: ['egg', 'eggs', 'frittata', 'omelet', 'omelette', 'shakshuka'],
	},
	{
		name: 'beans & lentils',
		sprite: 'beans',
		words: [
			'chickpea',
			'chickpeas',
			'lentil',
			'lentils',
			'black bean',
			'white bean',
			'beans',
			'dal',
			'dhal',
			'chana',
			'falafel',
			'hummus',
		],
	},
] as const satisfies readonly Part[]

export const formParts = [
	{
		name: 'tacos',
		sprite: 'corn',
		words: ['taco', 'tacos', 'tostada', 'tostadas'],
	},
	{
		name: 'bowl',
		sprite: 'rice',
		words: ['bowl', 'bowls', 'bibimbap', 'donburi', 'poke', 'poké'],
	},
	{
		name: 'pasta',
		sprite: 'pasta',
		words: [
			'pasta',
			'spaghetti',
			'penne',
			'rigatoni',
			'linguine',
			'fettuccine',
			'tagliatelle',
			'pappardelle',
			'orzo',
			'macaroni',
			'mac and cheese',
			'lasagna',
			'lasagne',
			'gnocchi',
			'ravioli',
			'tortellini',
			'orecchiette',
			'bucatini',
			'carbonara',
		],
	},
	{
		name: 'noodles',
		sprite: 'pasta',
		words: [
			'noodle',
			'noodles',
			'ramen',
			'udon',
			'soba',
			'pho',
			'lo mein',
			'chow mein',
			'pad thai',
			'pad see ew',
			'japchae',
			'dan dan',
			'khao soi',
		],
	},
	{ name: 'salad', sprite: 'lettuce', words: ['salad', 'slaw'] },
	{
		name: 'sandwich',
		sprite: 'bread',
		words: [
			'sandwich',
			'sandwiches',
			'burger',
			'burgers',
			'banh mi',
			'po boy',
			'sliders',
			'sub',
			'melt',
			'toastie',
			'croque',
		],
	},
	{
		name: 'wrap',
		sprite: 'bread',
		words: [
			'wrap',
			'wraps',
			'burrito',
			'burritos',
			'gyro',
			'gyros',
			'pita',
			'flatbread',
			'quesadilla',
			'lettuce cups',
		],
	},
	{
		name: 'soup & stew',
		sprite: 'broth',
		words: [
			'soup',
			'stew',
			'chili',
			'chowder',
			'gumbo',
			'jjigae',
			'pozole',
			'bisque',
			'minestrone',
			'tom yum',
			'tom kha',
		],
	},
	{
		name: 'curry',
		sprite: 'cardamom-pods',
		words: [
			'curry',
			'curries',
			'korma',
			'vindaloo',
			'masala',
			'massaman',
			'panang',
			'jalfrezi',
			'rogan josh',
			'saag',
		],
	},
	{
		name: 'rice',
		sprite: 'rice',
		words: [
			'fried rice',
			'risotto',
			'paella',
			'biryani',
			'jambalaya',
			'pilaf',
			'pilau',
			'congee',
		],
	},
	{
		name: 'skewers',
		sprite: 'meat',
		words: [
			'skewer',
			'skewers',
			'kebab',
			'kebabs',
			'kabob',
			'souvlaki',
			'satay',
			'yakitori',
		],
	},
	{
		name: 'stir fry',
		sprite: 'broccoli',
		words: ['stir fry', 'stir-fry', 'stir fried', 'stir-fried'],
	},
	{
		name: 'sheet pan & roast',
		sprite: 'potato',
		words: [
			'sheet pan',
			'sheet-pan',
			'traybake',
			'tray bake',
			'roast',
			'roasted',
		],
	},
] as const satisfies readonly Part[]

// Recipes that are not a meal of these parts: sweets, drinks, and basics.
const notAMeal = [
	'cake',
	'cakes',
	'cookie',
	'cookies',
	'brownie',
	'brownies',
	'pie crust',
	'tart',
	'muffin',
	'muffins',
	'cupcake',
	'pudding',
	'ice cream',
	'sorbet',
	'cocktail',
	'smoothie',
	'frosting',
	'icing',
	'jam',
	'syrup',
	'dessert',
	'fudge',
	'meringue',
	'scone',
	'scones',
	'cheesecake',
	'cobbler',
	'crumble',
]

export type MealPicks = {
	cuisine?: string | undefined
	flavor?: string | undefined
	protein?: string | undefined
	form?: string | undefined
}

export type MealTags = {
	cuisines: string[]
	flavors: string[]
	proteins: string[]
	forms: string[]
}

const normalize = (text: string) =>
	` ${text
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[’']/g, "'")
		.replace(/[^\p{L}\p{N}']+/gu, ' ')
		.trim()} `

// A word or phrase in a title, whole, with a plain plural allowed.
const mentions = (title: string, words: Words) =>
	words.some((word) => {
		const phrase = normalize(word).trim()

		return (
			title.includes(` ${phrase} `) ||
			title.includes(` ${phrase}s `) ||
			title.includes(` ${phrase}es `)
		)
	})

// The parts a recipe's title names. A flavor names its cuisine too.
export function mealTags(title: string): MealTags | undefined {
	const text = normalize(title)

	if (mentions(text, notAMeal)) return undefined

	const flavors = cuisineParts.flatMap((cuisine) =>
		cuisine.flavors.flatMap((flavor) =>
			mentions(text, flavor.words) ? [flavor.name] : [],
		),
	)

	const cuisines = cuisineParts.flatMap((cuisine) =>
		mentions(text, cuisine.words) ||
		cuisine.flavors.some((flavor) => flavors.includes(flavor.name))
			? [cuisine.name]
			: [],
	)

	const named = (parts: readonly Part[]) =>
		parts.flatMap((part) => (mentions(text, part.words) ? [part.name] : []))

	return {
		cuisines,
		flavors,
		proteins: named(proteinParts),
		forms: named(formParts),
	}
}

// A title's parts include every pick.
export function fitsPicks(tags: MealTags, picks: MealPicks) {
	return (
		(!picks.cuisine || tags.cuisines.includes(picks.cuisine)) &&
		(!picks.flavor || tags.flavors.includes(picks.flavor)) &&
		(!picks.protein || tags.proteins.includes(picks.protein)) &&
		(!picks.form || tags.forms.includes(picks.form))
	)
}

export const hasPicks = (picks: MealPicks) =>
	Boolean(picks.cuisine || picks.flavor || picks.protein || picks.form)

export type PartCount = { name: string; sprite: string; count: number }

export type MealCounts = {
	total: number
	cuisines: PartCount[]
	flavors: PartCount[]
	proteins: PartCount[]
	forms: PartCount[]
}

// How many titles each option would leave, given the other picks: the counts
// a step shows are for changing that step alone. An option with none is left
// out, unless it is the one picked.
export function countParts(
	tagged: readonly MealTags[],
	picks: MealPicks,
): MealCounts {
	const tally = (
		parts: readonly { name: string; sprite: string }[],
		without: MealPicks,
		has: (tags: MealTags, name: string) => boolean,
		chosen: string | undefined,
	) => {
		const counts = new Map<string, number>()

		for (const tags of tagged)
			if (fitsPicks(tags, without))
				for (const part of parts)
					if (has(tags, part.name))
						counts.set(part.name, (counts.get(part.name) ?? 0) + 1)

		return parts
			.flatMap((part) => {
				const count = counts.get(part.name) ?? 0

				return count > 0 || part.name === chosen
					? [{ name: part.name, sprite: part.sprite, count }]
					: []
			})
			.sort((a, b) => b.count - a.count)
	}

	const cuisine = cuisineParts.find(({ name }) => name === picks.cuisine)

	return {
		total: tagged.filter((tags) => fitsPicks(tags, picks)).length,
		cuisines: tally(
			cuisineParts,
			{ ...picks, cuisine: undefined, flavor: undefined },
			(tags, name) => tags.cuisines.includes(name),
			picks.cuisine,
		),
		flavors: cuisine
			? tally(
					cuisine.flavors,
					{ ...picks, flavor: undefined },
					(tags, name) => tags.flavors.includes(name),
					picks.flavor,
				)
			: [],
		proteins: tally(
			proteinParts,
			{ ...picks, protein: undefined },
			(tags, name) => tags.proteins.includes(name),
			picks.protein,
		),
		forms: tally(
			formParts,
			{ ...picks, form: undefined },
			(tags, name) => tags.forms.includes(name),
			picks.form,
		),
	}
}
