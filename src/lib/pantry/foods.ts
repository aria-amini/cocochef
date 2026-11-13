import { catalogSections, categoryKey } from './catalog'
import type { PantryCategory, PantryLevel } from './model'

// One food behind every line that names it: "2 cloves garlic, minced" on a
// recipe, "garlic" on the grocery list and "garlic" in the pantry are all the
// food `garlic`. Each food says how a kitchen keeps it:
//
// - kind: `stock` is kept by level alone (have it, running low, out), as
//   salt or flour is; `count` may also keep a number, as eggs or cans do.
// - staple: bought to keep, not for one meal. A staple goes back into the
//   pantry after shopping; short rib bought for a braise does not.
// - packs: the sizes it comes in, offered as quick adds (a dozen eggs).
export type Food = {
	key: string
	name: string
	category: PantryCategory
	kind: 'stock' | 'count'
	staple: boolean
	packs: readonly number[]
}

// Fresh food is bought for a meal, unless it is one of the few a kitchen
// keeps on hand.
const freshCategories = new Set<PantryCategory>(['meat', 'vegetables', 'fruit'])

const keptFresh = new Set([
	'onions',
	'red onion',
	'garlic',
	'shallots',
	'potatoes',
	'sweet potatoes',
	'carrots',
	'celery',
	'fresh ginger',
	'lemons',
	'limes',
])

// Shelf-stable sections still hold a few things bought for one dish.
const boughtForOne = new Set([
	'buttermilk',
	'ricotta',
	'goat cheese',
	'brie',
	'gruyere',
])

// Foods counted one by one, with the packs they come in.
const counted = new Map<string, readonly number[]>([
	['eggs', [12, 18]],
	['lemons', []],
	['limes', []],
	['oranges', []],
	['apples', []],
	['bananas', []],
	['pears', []],
	['peaches', []],
	['mango', []],
	['avocados', []],
	['onions', []],
	['red onion', []],
	['bell peppers', []],
	['cucumbers', []],
	['canned tomatoes', []],
	['tomato paste', []],
	['black beans', []],
	['chickpeas', []],
	['kidney beans', []],
	['coconut milk', []],
	['canned tuna', []],
])

const foods: readonly Food[] = catalogSections.flatMap(({ id, items }) =>
	items.map((name) => ({
		key: categoryKey(name),
		name,
		category: id,
		kind: counted.has(name) ? ('count' as const) : ('stock' as const),
		staple: freshCategories.has(id)
			? keptFresh.has(name)
			: !boughtForOne.has(name),
		packs: counted.get(name) ?? [],
	})),
)

// Longest first, so coconut milk is found before milk.
const byLength = [...foods].sort((a, b) => b.key.length - a.key.length)

// The food a line names, if the catalog knows it. Matches whole words after
// the same plural and accent folding the catalog uses, and treats "a can of"
// as canned: "1 (15-ounce) can chickpeas" is chickpeas, "2 cans tomatoes" is
// canned tomatoes.
export function foodOf(line: string): Food | undefined {
	const text = ` ${categoryKey(line.replace(/\bcans?\b/gi, 'canned'))} `

	return byLength.find(({ key }) => text.includes(` ${key} `))
}

// The pantry item a recipe or grocery line asks for. A food the catalog
// knows matches the same food, so "2 cloves garlic" finds garlic and coconut
// milk never finds milk. Anything else matches by its name's words: "2 lb
// short ribs" finds the short ribs the cook typed in.
export function findInPantry<Item extends { name: string }>(
	line: string,
	pantry: readonly Item[],
) {
	const food = foodOf(line)
	const words = ` ${categoryKey(line)} `

	return pantry.find((item) => {
		const kept = foodOf(item.name)

		if (kept) return kept.key === food?.key

		const name = categoryKey(item.name)

		return name.length > 0 && words.includes(` ${name} `)
	})
}

// About how many days a food keeps from the day it is bought, stored as a
// kitchen usually stores it: rough estimates, to sort what to use first, not
// food safety advice. A food without its own estimate takes its shelf's.
const shelfByCategory: Record<PantryCategory, number> = {
	spices: 730,
	meat: 3,
	dairy: 10,
	vegetables: 7,
	fruit: 7,
	grains: 365,
	cans: 730,
	sauces: 365,
	frozen: 240,
	other: 180,
}

const shelfByFood = new Map<string, number>([
	// Grains and baking
	['salt', 3650],
	['sugar', 3650],
	['brown sugar', 730],
	['powdered sugar', 730],
	['honey', 3650],
	['maple syrup', 365],
	['rice', 1460],
	['brown rice', 180],
	['pasta', 730],
	['spaghetti', 730],
	['flour', 365],
	['baking soda', 730],
	['baking powder', 365],
	['yeast', 120],
	['oats', 365],
	['bread', 5],
	['tortillas', 14],
	['cereal', 180],
	['crackers', 180],
	// Dairy and eggs
	['eggs', 35],
	['milk', 7],
	['oat milk', 10],
	['almond milk', 10],
	['butter', 60],
	['heavy cream', 10],
	['half and half', 10],
	['buttermilk', 14],
	['sour cream', 14],
	['yogurt', 14],
	['greek yogurt', 14],
	['cream cheese', 21],
	['cottage cheese', 7],
	['ricotta', 7],
	['cheddar', 30],
	['mozzarella', 10],
	['parmesan', 120],
	['feta', 21],
	['goat cheese', 14],
	['brie', 10],
	['gruyere', 30],
	// Vegetables and herbs
	['onions', 30],
	['red onion', 30],
	['garlic', 90],
	['shallots', 30],
	['potatoes', 30],
	['sweet potatoes', 21],
	['carrots', 21],
	['celery', 14],
	['fresh ginger', 21],
	['cabbage', 30],
	['scallions', 7],
	['jalapeños', 10],
	['bell peppers', 7],
	['tomatoes', 5],
	['cherry tomatoes', 7],
	['cucumbers', 7],
	['zucchini', 7],
	['eggplant', 7],
	['mushrooms', 5],
	['broccoli', 5],
	['cauliflower', 7],
	['brussels sprouts', 7],
	['green beans', 5],
	['asparagus', 4],
	['corn', 3],
	['peas', 4],
	['spinach', 5],
	['kale', 7],
	['lettuce', 5],
	['arugula', 4],
	['avocados', 4],
	['cilantro', 5],
	['parsley', 7],
	['fresh basil', 4],
	['fresh thyme', 10],
	// Fruit
	['apples', 30],
	['bananas', 5],
	['lemons', 21],
	['limes', 21],
	['oranges', 21],
	['strawberries', 4],
	['blueberries', 7],
	['raspberries', 3],
	['grapes', 7],
	['cherries', 5],
	['peaches', 5],
	['pears', 7],
	['pineapple', 4],
	['mango', 5],
	['watermelon', 7],
	['kiwi', 14],
	['raisins', 180],
	// Meat, fish and the like
	['bacon', 7],
	['sausage', 4],
	['chorizo', 21],
	['ham', 5],
	['prosciutto', 21],
	['salami', 21],
	['hot dogs', 7],
	['deli turkey', 5],
	['steak', 3],
	['brisket', 3],
	['lamb', 3],
	['tuna steak', 2],
	['salmon', 2],
	['shrimp', 2],
	['cod', 2],
	['tilapia', 2],
	['scallops', 2],
	['tofu', 7],
	['tempeh', 10],
	// Cans and dry goods
	['peanut butter', 180],
	['almonds', 180],
	['walnuts', 180],
	['peanuts', 180],
	['lentils', 730],
	['olives', 365],
	['pickles', 365],
	// Oils and sauces
	['olive oil', 540],
	['vegetable oil', 365],
	['sesame oil', 365],
	['soy sauce', 730],
	['fish sauce', 730],
	['white vinegar', 1825],
	['balsamic vinegar', 1825],
	['red wine vinegar', 1825],
	['rice vinegar', 1825],
	['apple cider vinegar', 1825],
	['hot sauce', 365],
	['sriracha', 365],
	['ketchup', 180],
	['mustard', 365],
	['dijon', 365],
	['mayonnaise', 60],
	['pesto', 7],
	['salsa', 14],
	['tahini', 180],
	['jam', 180],
	['vanilla extract', 1825],
])

// How long a food keeps, in days, from the day it was bought.
export function shelfLife(name: string, category: PantryCategory) {
	// Kept frozen, whatever it is called: "frozen salmon" is not fresh salmon.
	if (category === 'frozen') return shelfByCategory.frozen

	const food = foodOf(name)

	return (
		(food && shelfByFood.get(food.name)) ??
		shelfByCategory[food?.category ?? category]
	)
}

// Food that keeps a month or less spoils: it is dated from the day it was
// bought, and says how long ago that was.
const spoilsWithin = 30

// How many days a cook's word about a food that keeps longer holds, before
// it is worth a check that it is still there.
const trustedFor = 120

const day = 86_400_000

// What the pantry can still say of an item, and how many days it has left.
// Food that spoils is fresh until its days are up and a day more; then a
// staple is stale (probably bought again, worth a check) and anything else
// has expired, since the meal it was for has likely eaten it. Food that
// keeps is fresh while the cook's word holds, then stale.
export function shelfState(
	item: {
		name: string
		category: PantryCategory
		confirmedAt: Date
		boughtAt: Date
		frozenAt?: Date | null | undefined
	},
	now: Date,
) {
	// Put in the freezer, it keeps as frozen food does, from the day it went in.
	const frozen = item.frozenAt ?? undefined

	const keeps = frozen
		? shelfLife(item.name, 'frozen')
		: shelfLife(item.name, item.category)

	const spoils = keeps <= spoilsWithin
	const food = foodOf(item.name)
	const staple = food ? food.staple : !freshCategories.has(item.category)
	const bought = (now.getTime() - (frozen ?? item.boughtAt).getTime()) / day
	const confirmed = (now.getTime() - item.confirmedAt.getTime()) / day

	const state = spoils
		? bought <= keeps + 1
			? 'fresh'
			: staple
				? 'stale'
				: 'expired'
		: confirmed <= trustedFor
			? 'fresh'
			: 'stale'

	return {
		state,
		spoils,
		daysLeft: Math.max(0, Math.ceil(keeps - bought)),
		boughtDaysAgo: Math.max(0, Math.floor(bought)),
	} as const
}

// A count says the level on its own: none is out, a few is running low (a
// quarter of the smallest pack, so three eggs of a dozen), more is plenty.
export function levelForCount(count: number, food: Food | undefined) {
	const few = Math.max(1, Math.floor((food?.packs[0] ?? 0) / 4))

	const level: PantryLevel =
		count <= 0 ? 'out' : count <= few ? 'low' : 'plenty'

	return level
}

// Words around a food that say how much or how it should be, not what it is,
// as the catalog folds them: "plus" reads "plu".
const measures = new Set(
	`a an of or and as for to at plu about approximately more extra additional
	needed taste divided reserved optional serve serving garnish few some splash dash handful drop
	cup c tablespoon tbsp tbs t teaspoon tsp ml millilitre milliliter l litre
	liter quart qt pint gallon oz ounce fl fluid g gram kg lb pound
	warm hot cold boiling lukewarm iced chilled cool cooled very room
	temperature filtered tap salted`.split(/\s+/),
)

const freeFood = new Set(['water', 'ice', 'cube'])

// Lines nobody shops for: water from the tap and ice from the freezer, however
// the recipe measures or warms them. Pasta water and cooking water come from
// the pot. Coconut water, rose water or sparkling water still go on the list.
export function neverBuy(line: string) {
	const words = categoryKey(
		line.replace(/\b(pasta|cooking)\s+water\b/gi, 'water'),
	)
		.split(' ')
		.filter((word) => word && !/^\p{N}+$/u.test(word) && !measures.has(word))

	return words.length > 0 && words.every((word) => freeFood.has(word))
}
