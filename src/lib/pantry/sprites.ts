import { z } from 'zod'

import { ingredientSubject } from '../recipes/ingredient-line'
import { foodFamily } from './food-family'
import type { PantryCategory } from './model'
import {
	isFreshPlant,
	jarLook,
	standardLook,
	tintedFamilySprites,
	tintedLook,
	type Rule,
	type SpriteLook,
} from './tinted-sprites'

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
	sprite('apple', 'fruit', ['apple', 'apples', 'applesauce']),
	sprite('avocado', 'fruit', ['avocado', 'avocados']),
	sprite('bacon', 'protein', [
		'bacon',
		'turkey bacon',
		'pancetta',
		'guanciale',
	]),
	sprite('banana', 'fruit', ['banana', 'bananas']),
	sprite('bell-pepper', 'vegetable', [
		'bell pepper',
		'bell peppers',
		'capsicum',
		'red capsicum',
		'red pepper',
		'red peppers',
		'green pepper',
		'yellow pepper',
		'orange pepper',
	]),
	sprite('black-pepper', 'spice', [
		'black pepper',
		'peppercorns',
		'peppercorn',
	]),
	sprite('blueberries', 'fruit', ['blueberry', 'blueberries']),
	sprite('bread', 'grain', [
		'bread',
		'loaf',
		'rolls',
		'buns',
		'sourdough',
		'challah',
	]),
	sprite('broccoli', 'vegetable', ['broccoli']),
	sprite('butter', 'dairy', ['butter', 'lard']),
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
		'provolone',
		'camembert',
		'havarti',
		'parmigiano reggiano',
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
	sprite('chocolate', 'other', ['chocolate', 'cocoa', 'cacao']),
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
		'mackerel',
		'basa',
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
	sprite('lemon', 'fruit', ['lemon', 'lemons']),
	sprite('lettuce', 'vegetable', [
		'lettuce',
		'romaine',
		'arugula',
		// Not bare "greens": singularized it would match "green onions".
		'salad greens',
		'mixed greens',
		'baby greens',
		'iceberg',
		'endive',
		'frisee',
		'watercress',
		'pak choi',
		'bok choy',
		'chicory',
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
		'oxtail',
		'oxtails',
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
		'beetroot',
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
		'noodles',
	]),
	sprite('zucchini', 'vegetable', [
		'zucchini',
		'courgette',
		'squash',
		'summer squash',
		'pumpkin',
		'butternut squash',
		'acorn squash',
	]),
	// Pantry staples the recipe corpus showed with only a generic jar.
	sprite('beans', 'other', [
		'beans',
		'black beans',
		'kidney beans',
		'pinto beans',
		'cannellini beans',
		'chickpeas',
		'lentils',
	]),
	// Stock cubes are a seasoning, so only broth names are aliases here; the
	// family rule picks up "stock" and "bouillon" that are not cubes.
	sprite('broth', 'other', [
		'broth',
		'chicken broth',
		'vegetable broth',
		'beef broth',
		'bone broth',
	]),
	sprite('can', 'other', [
		'coconut milk',
		'coconut cream',
		'condensed milk',
		'evaporated milk',
	]),
	sprite('extract', 'other', [
		'vanilla extract',
		'vanilla paste',
		'almond extract',
		'peppermint extract',
	]),
	sprite('ginger', 'vegetable', ['ginger', 'fresh ginger', 'ginger root']),
	sprite('lime', 'fruit', ['lime', 'limes', 'lime juice']),
	sprite('sauce', 'other', [
		'soy sauce',
		'tamari',
		'fish sauce',
		'worcestershire sauce',
		'oyster sauce',
		'hot sauce',
		'sriracha',
		'ketchup',
		'bbq sauce',
		'teriyaki',
		'hoisin',
	]),
	sprite('seeds', 'other', [
		'chia seeds',
		'flaxseed',
		'sesame seeds',
		'poppy seeds',
		'sunflower seeds',
		'pumpkin seeds',
		'pepitas',
	]),
	sprite('spirits', 'other', [
		'bourbon',
		'whiskey',
		'vodka',
		'gin',
		'rum',
		'tequila',
		'brandy',
	]),
	sprite('spread', 'other', [
		'mayonnaise',
		'tahini',
		'hummus',
		'peanut butter',
		'almond butter',
		'miso',
		'jam',
	]),
	sprite('vinegar', 'other', [
		'vinegar',
		'balsamic vinegar',
		'red wine vinegar',
		'white wine vinegar',
		'apple cider vinegar',
		'rice vinegar',
	]),
	sprite('wine', 'other', [
		'wine',
		'red wine',
		'white wine',
		'sherry',
		'vermouth',
		'sake',
	]),
	// Foods that had no picture, or only a generic one.
	sprite('celery', 'vegetable', [
		'celery',
		'celery stalks',
		'celery ribs',
		'celery sticks',
	]),
	sprite('cauliflower', 'vegetable', ['cauliflower', 'cauliflower florets']),
	sprite('asparagus', 'vegetable', ['asparagus']),
	sprite('brussels-sprouts', 'vegetable', [
		'brussels sprouts',
		'brussels sprout',
	]),
	sprite('green-beans', 'vegetable', [
		'green beans',
		'string beans',
		'runner beans',
		'haricots verts',
		'snap beans',
	]),
	// Bare "fennel" is also the seed, so the family rule picks the bulb up.
	sprite('fennel', 'vegetable', ['fennel bulb', 'fennel bulbs']),
	sprite('artichoke', 'vegetable', [
		'artichoke',
		'artichokes',
		'artichoke hearts',
	]),
	sprite('parsnip', 'vegetable', ['parsnip', 'parsnips']),
	sprite('bay-leaves', 'vegetable', ['bay leaf', 'bay leaves']),
	sprite('lemongrass', 'vegetable', ['lemongrass', 'lemon grass']),
	sprite('plantain', 'fruit', ['plantain', 'plantains']),
	sprite('coconut-half', 'fruit', ['coconut']),
	sprite('cranberries', 'fruit', ['cranberry', 'cranberries']),
	sprite('pomegranate', 'fruit', [
		'pomegranate',
		'pomegranate arils',
		'pomegranate seeds',
	]),
	sprite('kiwi', 'fruit', ['kiwi', 'kiwifruit', 'kiwi fruit']),
	sprite('papaya', 'fruit', ['papaya']),
	sprite('fig', 'fruit', ['fig', 'figs']),
	sprite('dates', 'fruit', ['dates', 'medjool dates']),
	sprite('tofu', 'protein', ['tofu']),
	sprite('shrimp', 'protein', ['shrimp', 'prawns', 'prawn']),
	sprite('pasta', 'grain', [
		'pasta',
		'spaghetti',
		'penne',
		'macaroni',
		'linguine',
		'fettuccine',
		'lasagna',
		'lasagne',
		'orzo',
		'rigatoni',
		'fusilli',
		'tagliatelle',
		'rotini',
		'cavatappi',
		'gnocchi',
	]),
	sprite('dough', 'grain', [
		'dough',
		'pizza dough',
		'bread dough',
		'cookie dough',
	]),
	sprite('crackers', 'grain', [
		'crackers',
		'cracker',
		'graham crackers',
		'graham cracker',
		'saltines',
		'oyster crackers',
		'animal crackers',
		'crostini',
	]),
	sprite('marshmallows', 'other', [
		'marshmallow',
		'marshmallows',
		'mini marshmallows',
	]),
	sprite('sprinkles', 'other', ['sprinkles', 'rainbow sprinkles']),
	sprite('caramel-candy', 'other', [
		'caramels',
		'caramel candies',
		'candy',
		'candies',
		'toffee',
		'candy canes',
	]),
	// Whole spices. The ground ones are tinted jars (tinted-sprites.ts).
	sprite('cinnamon-sticks', 'spice', ['cinnamon stick', 'cinnamon sticks']),
	sprite('star-anise', 'spice', ['star anise']),
	sprite('cloves', 'spice', ['cloves', 'whole cloves']),
	sprite('cardamom-pods', 'spice', ['cardamom pods', 'cardamom pod']),
	sprite('saffron', 'spice', ['saffron', 'saffron threads']),
	sprite('dried-chilies', 'spice', [
		'dried chilies',
		'dried chiles',
		'dried chili',
		'dried chile',
		'dried red chilies',
	]),
	sprite('vanilla-pods', 'spice', [
		'vanilla bean',
		'vanilla beans',
		'vanilla pod',
		'vanilla pods',
	]),
	sprite('nutmeg', 'spice', ['nutmeg', 'whole nutmeg']),
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
			'radicchio',
			'broccolini',
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
	return `/sprites/pantry/${resolveSpriteKey(name, spriteKey, category)}.png`
}

// A pantry item's picture, painted when its food has a recolourable sprite.
// An explicit sprite key is a choice, so it is left as it is.
export function resolveSpriteLook(
	name: string,
	spriteKey?: string | null,
	category?: PantryCategory,
): SpriteLook {
	const chosen =
		spriteKey &&
		(spriteKeys.has(spriteKey) ||
			Object.values(fallbackKeys).includes(spriteKey))

	const look =
		(!chosen && tintedLook(normalizeName(name))) ||
		standardLook({ key: resolveSpriteKey(name, spriteKey, category) })

	// Whatever is kept with the spices is kept dried, in a jar.
	return category === 'spices' ? jarLook(look) : look
}

function resolveSpriteKey(
	name: string,
	spriteKey?: string | null,
	category?: PantryCategory,
): string {
	if (
		spriteKey &&
		(spriteKeys.has(spriteKey) ||
			Object.values(fallbackKeys).includes(spriteKey))
	) {
		return spriteKey
	}

	const normalized = ` ${normalizeName(name)} `

	const match = spriteMatches.find(({ alias }) =>
		normalized.includes(` ${alias} `),
	)

	// A known category beats a keyword guess, but not a specific sprite.
	const fallback = category && categoryFallbacks[category]

	return match && !match.guess
		? match.key
		: fallback
			? fallbackKeys[fallback]
			: (match?.key ?? fallbackKeys.other)
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
const plainFamilySprites = [
	// Plain "pepper" in a recipe is the grinder, not a vegetable.
	[
		'black-pepper',
		/^(?:(?:freshly|fresh)\s+)?(?:(?:ground|cracked|white|black)\s+)*pepper(?:\s+to taste)?$/,
	],
	[
		'chili-pepper',
		/\b(?:chil+i?e? flakes|red pepper flakes|crushed red pepper|pepper flakes)\b/,
	],
	['butter', /\bghee\b/],
	// Not vanilla bean ice cream, which is ice cream.
	[
		'extract',
		/^(?!.*\bice cream\b)(?:.*\b(?:extract|vanilla (?:bean|paste))\b|(?:pure )?vanilla$)/,
	],
	['can', /\b(?:coconut (?:milk|cream)|condensed milk|evaporated milk)\b/],
	// A stock cube is a seasoning, not a carton of stock.
	['broth', /\b(?:broth|stock(?! cubes?)|bouillon(?! cubes?)|consomme)\b/],
	['vinegar', /\bvinegar\b/],
	[
		'spread',
		/\b(?:mayonnaise|mayo|tahini|hummus|(?:almond|peanut|nut|cashew) butter|miso|gochujang|harissa|pesto|salsa|jam|jelly|marmalade|preserves)\b/,
	],
	[
		'sauce',
		/\b(?:(?<!apple )sauce|ketchup|sriracha|tamari|mirin|worcestershire|teriyaki|hoisin|sambal)\b/,
	],
	['wine', /\b(?:wine|sherry|vermouth|sake|marsala)\b/],
	[
		'spirits',
		/\b(?:bourbon|whiskey|whisky|vodka|gin|rum|tequila|brandy|cognac|triple sec|liqueur)\b/,
	],
	[
		'seeds',
		// Not the oils pressed from them.
		/^(?!.*\boils?\b).*\b(?:(?:chia|flax|sesame|poppy|sunflower|pumpkin|hemp) seeds?|chia|flaxseeds?|flax meal|pepitas)\b/,
	],
	[
		'ginger',
		/\b(?<!ground |powdered |crystallized |candied |pickled )ginger\b(?! powder| ale| beer| snaps?)/,
	],
	// Whatever else has no picture of its own.
	[
		'fallback-other',
		/\b(?:(?:stock|bouillon) cubes?|gelatin|molasses|tamarind|horseradish|capers|cornichons|kimchi|bitters|seltzer)\b/,
	],
	[
		'olive-oil',
		/^(?!.*\boil packed\b).*\b(?:oils?|(?:cooking|baking|nonstick) spray)\b/,
	],
	[
		'fallback-spice',
		/\b(?:garlic powder|onion powder|mustard seeds?|ground ginger|ginger powder|powdered ginger|chili powder|chilli powder|cayenne|garam masala|za atar|sumac|seasoning|five spice|msg|star anise|fenugreek|herbes de provence)\b/,
	],
	['fennel', /\bfennel\b(?! seeds?)/],
	[
		'pasta',
		/\b(?:pasta|spaghetti|linguine|fettuccine|penne|macaroni|orzo|lasagne|lasagna|rigatoni|fusilli|tagliatelle|rotini|cavatappi|gnocchi)\b/,
	],
	['wheat', /\b(?:noodles|ramen|udon|soba|semolina|bulgur|farro)\b/],
	[
		'bread',
		/\b(?:breadcrumbs|panko|tortillas?|pita|bagels?|baguettes?|ciabatta|focaccia|english muffins?|naan|brioche|croissants?|pretzels?)\b/,
	],
	[
		'flour',
		/\b(?:sugar(?! snap)|cornstarch|corn starch|cornflour|cream of tartar|tapioca starch|potato starch|arrowroot|custard powder|baking powder|baking soda|bicarbonate|yeast)\b/,
	],
	['fallback-dairy', /\bice cream\b/],
	[
		'cheese',
		/\b(?:cream cheese|ricotta|halloumi|paneer|mascarpone|pecorino|manchego|gorgonzola|burrata|cotija|queso)\b/,
	],
	[
		'milk',
		/\b(?:cream|yogurt|yoghurt|buttermilk|half and half|kefir|labneh|skyr|quark)\b/,
	],
	[
		'meat',
		// Cuts with a sprite of their own are left to it: "pork sausages" and
		// "turkey bacon" are sausages and bacon, "beef brisket" is a steak.
		/^(?!.*\b(?:sausages?|bacon|steaks?|brisket|ham)\b).*\b(?:beef(?! tomato)|pork|lamb|mutton|mince|turkey|duck|goose|venison|rabbit|veal)\b/,
	],
	['sausage', /\b(?:hot dogs?|frankfurters?)\b/],
	[
		'green-beans',
		/\b(?:green beans|runner beans|string beans|haricots verts)\b/,
	],
	[
		'beans',
		/\b(?<!coffee |vanilla |cocoa |cacao |jelly )beans?\b|\b(?:chickpeas?|garbanzo|lentils?|edamame)\b/,
	],
	['tofu', /\btofu\b/],
	['fallback-protein', /\btempeh\b/],
	[
		'kale',
		/\b(?:coriander (?:leaves|leaf)|(?:fresh|chopped) coriander|coriander to serve|celery leaves)\b/,
	],
	[
		'grapes',
		/\b(?:sultanas?|currants?|raisins?|prunes?|dried (?:cranberries|figs?|apricots?|cherries|mango))\b/,
	],
	// Plain water and ice. Not "coconut water" or "rose water", and not
	// "milk or water", which is milk.
	[
		'ice-cube',
		/^(?!.*\bor\b).*(?:\bice\b|(?<!coconut |rose |flower |orange blossom |tonic |soda |sparkling |mineral )\bwater\b(?! chestnut))/,
	],
] as const

// Foods with a recolourable sprite come first, so a specific food is not taken
// by the general family it belongs to.
const ingredientFamilySprites: readonly Rule[] = [
	...tintedFamilySprites,
	...plainFamilySprites,
]

// Recipe rows accept familiar family stand-ins: leafy greens for herbs, meat
// for pork/lamb, and fish for seafood. Unknown foods still leave the slot empty.
export function ingredientItemSprite(name: string) {
	return ingredientItemLook(name)?.key
}

// Words that say a plant is kept dried: "dried thyme", "ground ginger",
// "red pepper flakes".
const driedWords =
	/\b(?:dried|ground|powder(?:ed)?|flakes?|crushed|granules?|rubbed)\b/

// The picture for a recipe's ingredient line: a sprite and, for a recolourable
// one, the colour to paint it. A plant kept dried is a jar.
export function ingredientItemLook(name: string): SpriteLook | undefined {
	const look = freshItemLook(name)

	if (!look) return undefined

	return isFreshPlant(look) && driedWords.test(normalizeName(name))
		? jarLook(look)
		: look
}

function freshItemLook(name: string): SpriteLook | undefined {
	// The food itself: the measuring is taken off, then everything from a
	// comma, a bracket, "with ..." or "in oil/brine" on.
	const main = normalizeName(
		(ingredientSubject(name).split(/[,;(]/, 1)[0] ?? '')
			.replace(
				/\b(?:packed )?in (?:[\w-]+ )*(?:oil|brine|water|syrup|juice)\b.*$/i,
				'',
			)
			.replace(/\bwith\b.*$/i, ''),
	)

	if (!main || name.trimStart().startsWith('#')) return undefined

	const familySprite = ingredientFamilySprites.find(([, pattern]) =>
		pattern.test(main),
	)

	if (familySprite) {
		const [key, , tint] = familySprite

		return standardLook(tint ? { key, tint } : { key })
	}

	const family = foodFamily(main)
	const normalized = ` ${singularIngredientWords(main)} `

	// A food with its own picture wins over its family's stand-in, and over a
	// generic keyword however long the keyword: "juice of 1 lime" is a lime, not
	// just some juice.
	const named = ingredientMatches.find(
		({ alias, guess }) => !guess && normalized.includes(` ${alias} `),
	)

	if (named) return standardLook({ key: named.key })

	const match = ingredientMatches.find(({ alias }) =>
		normalized.includes(` ${alias} `),
	)

	if (family?.id === 'herb') return { key: 'kale' }

	if (family?.id === 'fish') return { key: 'fish' }

	if (family?.id === 'meat') return { key: 'meat' }

	if (family?.id === 'grain') return { key: 'wheat' }

	if (family?.id === 'seed') return { key: 'fallback-grain' }

	return match ? standardLook({ key: match.key }) : undefined
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
