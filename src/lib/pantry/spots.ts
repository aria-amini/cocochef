import { shelfLife } from './foods'
import type { PantryCategory } from './model'

// Where food lives in a kitchen, which is how a cook looks for it: the
// fridge, the counter, the cupboard, the spice rack and the freezer.
export const pantrySpots = [
	'fridge',
	'counter',
	'pantry',
	'spices',
	'freezer',
] as const

export type PantrySpot = (typeof pantrySpots)[number]

export const pantrySpotLabels: Record<PantrySpot, string> = {
	fridge: 'fridge',
	counter: 'counter',
	pantry: 'pantry',
	spices: 'spice rack',
	freezer: 'freezer',
}

export const pantrySpotSprites: Record<PantrySpot, string> = {
	fridge: 'milk',
	counter: 'banana',
	pantry: 'can',
	spices: 'fallback-spice',
	freezer: 'ice-cube',
}

type Food = {
	name: string
	category: PantryCategory
	frozenAt?: Date | null | undefined
}

// Fresh food that keeps three weeks and more sits out: onions, potatoes,
// garlic, squash.
const keepsOut = 21

// Fruit left out to ripen, whatever it keeps for.
const ripening =
	/\b(?:bananas?|avocados?|tomato(?:es)?|mangoe?s?|peach(?:es)?|nectarines?|pears?|plums?|kiwis?|pineapples?|(?:water)?melons?|papayas?)\b/

// Sauces kept cold once opened, on the fridge door.
const door =
	/\b(?:mayo(?:nnaise)?|aioli|mustard|dijon|ketchup|relish|pesto|miso|kimchi|salsa|jam|jelly|preserves|marmalade|gochujang|sriracha|tahini|horseradish|pickles?|capers|hot sauce)\b/

// Herbs bought fresh, by the bunch.
const herbs =
	/\b(?:cilantro|coriander leaves|parsley|basil|mint|dill|thyme|rosemary|chives|sage|tarragon|oregano|marjoram|bay|lemongrass)\b/

// The spot a food lives in, from what kind of food it is.
export function spotOf(food: Food): PantrySpot {
	// Whatever it is, the cook put it in the freezer.
	if (food.frozenAt) return 'freezer'

	const name = food.name.toLowerCase()

	switch (food.category) {
		case 'spices':
			return 'spices'
		case 'frozen':
			return 'freezer'
		case 'meat':
		case 'dairy':
			return 'fridge'
		case 'vegetables':
		case 'fruit':
			return ripening.test(name) ||
				shelfLife(food.name, food.category) > keepsOut
				? 'counter'
				: 'fridge'
		case 'sauces':
			return door.test(name) ? 'fridge' : 'pantry'
		default:
			return 'pantry'
	}
}

type Shelf = { id: string; label: string; holds: (food: Food) => boolean }

const shelf = (
	id: string,
	label: string,
	holds: (food: Food, name: string) => boolean,
): Shelf => ({
	id,
	label,
	holds: (food) => holds(food, food.name.toLowerCase()),
})

// What is left over on a spot with shelves of its own.
const rest = (label = 'other') => shelf('other', label, () => true)

// Each spot's shelves, in the order a cook looks along them. A food sits on
// the first that holds it.
const shelvesBySpot: Record<PantrySpot, Shelf[]> = {
	spices: [
		shelf('salt-pepper', 'salt & pepper', (_, name) =>
			/\bsalt\b|\b(?:black|white) pepper\b|\bpeppercorns?\b|^pepper$/.test(
				name,
			),
		),
		shelf('blends', 'blends', (_, name) =>
			/\b(?:seasoning|masala|curry|five spice|za.?atar|blend|mix|herbes de provence|old bay|bagel|cajun|jerk|ras el hanout|baharat|dukkah|furikake|chili powder)\b/.test(
				name,
			),
		),
		shelf('dried-herbs', 'dried herbs', (_, name) => herbs.test(name)),
		shelf(
			'whole',
			'whole spices & seeds',
			(_, name) =>
				/\b(?:seeds?|whole|sticks?|pods?|star anise|saffron|cloves?|nutmeg|threads)\b/.test(
					name,
				) && !/\bground\b/.test(name),
		),
		rest('ground spices'),
	],
	pantry: [
		shelf('oils', 'oils & vinegars', (_, name) =>
			/\boils?\b|\bvinegar\b|\bcooking spray\b/.test(name),
		),
		shelf('baking', 'baking', (_, name) =>
			/\b(?:flour|sugar|baking|yeast|cocoa|cacao|chocolate|vanilla|extract|starch|cornflour|sprinkles|gelatin|cream of tartar|food colou?ring)\b/.test(
				name,
			),
		),
		shelf('sweet', 'sweet things & spreads', (_, name) =>
			/\b(?:honey|syrup|agave|molasses|nutella|spread|(?:peanut|almond|cashew|nut) butter)\b/.test(
				name,
			),
		),
		shelf('drinks', 'drinks', (_, name) =>
			/\b(?:wine|beer|vodka|rum|whiske?y|bourbon|gin|tequila|sake|brandy|vermouth|juice|coffee|tea|soda|seltzer|tonic)\b/.test(
				name,
			),
		),
		shelf('beans', 'beans & lentils', (_, name) =>
			/\b(?:beans?|lentils?|chickpeas?|split peas)\b/.test(name),
		),
		shelf('nuts', 'nuts & dried fruit', (_, name) =>
			/\b(?:nuts?|almonds?|walnuts?|pecans?|cashews?|peanuts?|pistachios?|hazelnuts?|pine nuts|raisins?|dates|prunes|dried|seeds?)\b/.test(
				name,
			),
		),
		shelf(
			'cans',
			'cans & cartons',
			(food, name) =>
				food.category === 'cans' ||
				/\b(?:canned|tinned|broth|stock|coconut milk)\b/.test(name),
		),
		shelf(
			'sauces',
			'sauces & condiments',
			(food) => food.category === 'sauces',
		),
		shelf('grains', 'grains & pasta', (food) => food.category === 'grains'),
		rest(),
	],
	fridge: [
		shelf(
			'herbs',
			'fresh herbs',
			(food, name) => food.category === 'vegetables' && herbs.test(name),
		),
		shelf(
			'produce',
			'fruit & veg',
			(food) => food.category === 'vegetables' || food.category === 'fruit',
		),
		shelf('meat', 'meat & fish', (food) => food.category === 'meat'),
		shelf('dairy', 'dairy & eggs', (food) => food.category === 'dairy'),
		shelf('door', 'door', (food) => food.category === 'sauces'),
		rest(),
	],
	counter: [rest('counter')],
	freezer: [
		shelf('meat', 'meat & fish', (_, name) =>
			/\b(?:chicken|beef|pork|lamb|turkey|sausages?|fish|salmon|cod|shrimp|prawns|scallops|meat|burgers?)\b/.test(
				name,
			),
		),
		shelf('sweets', 'sweets', (_, name) =>
			/\b(?:ice cream|sorbet|gelato|popsicles?|ice pops?)\b/.test(name),
		),
		shelf('baking', 'bread & baking', (_, name) =>
			/\b(?:bread|rolls?|buns?|bagels?|pastry|pie crust|dough|waffles?|tortillas?)\b/.test(
				name,
			),
		),
		shelf('produce', 'veg & fruit', (_, name) =>
			/\b(?:peas|corn|spinach|berries|strawberries|blueberries|mango|vegetables?|broccoli|edamame|fruit)\b/.test(
				name,
			),
		),
		rest(),
	],
}

// A spot's food by shelf, shelves in order, none empty.
export function shelvesOf<Item extends Food>(spot: PantrySpot, items: Item[]) {
	const shelves = shelvesBySpot[spot]
	const placed = new Map<string, Item[]>()

	for (const item of items) {
		const on = shelves.find((entry) => entry.holds(item)) ?? rest()

		placed.set(on.id, [...(placed.get(on.id) ?? []), item])
	}

	return shelves.flatMap((entry) => {
		const held = placed.get(entry.id)

		return held ? [{ id: entry.id, label: entry.label, items: held }] : []
	})
}
