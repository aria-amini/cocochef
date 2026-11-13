import { foodOf } from '@/lib/pantry/foods'

// How much a recipe asks of the cook, read from what it says: how long it
// takes and how much of that is hands on, what it would take to shop for,
// how many it serves and how long what is left keeps. All of it is read from
// words, so it is rounded and said as "about".

// What a recipe's own page and steps say of its time and keeping, worked out
// once on the server.
export type RecipeEffort = {
	// The whole time, hands on, and waiting, in minutes, when known.
	totalMinutes?: number | undefined
	activeMinutes?: number | undefined
	waitingMinutes?: number | undefined
	// What the waiting is: "simmer", "marinate".
	waits: string[]
	// A step that takes the night, so it starts the day before.
	dayBefore: boolean
	servings?: number | undefined
	keeps: Keeping
	// How many foods it takes, and whether none is meat or fish.
	foods: number
	vegetarian: boolean
	// Meat-free, and without milk, eggs or honey either.
	vegan: boolean
}

// How long what is left keeps in the fridge, by the usual rule for cooked
// food, and whether it freezes well. Food best eaten at once says so.
export type Keeping = { days: string; freezes: boolean }

// Doing words for time the cook is not at the stove, by the word a cook
// would use for it. Sautéing, frying and stirring are hands on.
const waitingWords = new Map([
	['marinat', 'marinate'],
	['simmer', 'simmer'],
	['braise', 'braise'],
	['bake', 'bake'],
	['roast', 'roast'],
	['rest', 'rest'],
	['chill', 'chill'],
	['refrigerat', 'chill'],
	['freez', 'freeze'],
	['rise', 'rise'],
	['proof', 'rise'],
	['soak', 'soak'],
	['cool', 'cool'],
	['brine', 'brine'],
	['steep', 'steep'],
	['slow cook', 'slow-cook'],
	['slow-cook', 'slow-cook'],
	['pressure', 'pressure-cook'],
	['set aside', 'rest'],
	['let it sit', 'rest'],
	['let sit', 'rest'],
	['sit at room', 'rest'],
	['let stand', 'rest'],
	['let it stand', 'rest'],
])

// Doing words that keep the cook at the stove, whatever else a sentence says.
const handsOnPattern =
	/\b(?:fry|fried|frying|saut[ée]\w*|sear\w*|stir|stirring|whisk\w*|flip\w*|toss\w*|knead\w*|brown\w*)\b/i

const waitingPattern = new RegExp(
	`\\b(${[...waitingWords.keys()].join('|')})`,
	'i',
)

const numberWords = new Map([
	['a', 1],
	['an', 1],
	['one', 1],
	['two', 2],
	['three', 3],
	['four', 4],
	['five', 5],
	['six', 6],
	['eight', 8],
	['ten', 10],
	['twelve', 12],
	['fifteen', 15],
	['twenty', 20],
	['thirty', 30],
	['forty', 40],
	['forty-five', 45],
])

// "2 hours", "1 1/2 hours", "30-40 minutes", "an hour": the longest time a
// sentence names, in minutes, since a range is waited out to its end.
const timePattern =
	/\b(\d+(?:[.,]\d+)?(?:\s+1\/2)?|a|an|one|two|three|four|five|six|eight|ten|twelve|fifteen|twenty|thirty|forty|forty-five)(?:\s*(?:to|-|–)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|h|minutes?|mins?)\b/gi

function longestTime(sentence: string) {
	let longest = 0

	for (const match of sentence.matchAll(timePattern)) {
		const [, low = '', high, unit = ''] = match
		const half = low.endsWith(' 1/2') ? 0.5 : 0

		const first =
			numberWords.get(low.toLowerCase()) ??
			Number(low.replace(' 1/2', '').replace(',', '.')) + half

		const amount = high ? Number(high.replace(',', '.')) : first
		const minutes = /^h/i.test(unit) ? amount * 60 : amount

		if (Number.isFinite(minutes)) longest = Math.max(longest, minutes)
	}

	return longest
}

// The waiting a recipe's steps name: each sentence with a waiting word and a
// time counts that time once. "Overnight" or a day's chill starts the day
// before rather than adding to the evening.
export function stepWaits(steps: readonly string[]) {
	let minutes = 0
	let dayBefore = false
	const waits = new Set<string>()

	for (const sentence of steps.flatMap((step) =>
		step.split(/(?<=[.!?;])\s+/),
	)) {
		const word = waitingPattern.exec(sentence)?.[1]?.toLowerCase()

		// Frying a few minutes and setting it aside is the cook's time.
		if (!word || handsOnPattern.test(sentence)) continue

		const named = [...waitingWords].find(([stem]) => word.startsWith(stem))?.[1]

		if (/\bovernight\b|\b(?:24|12)\s*hours?\b|\bfor a day\b/i.test(sentence)) {
			dayBefore = true

			if (named) waits.add(named)

			continue
		}

		const time = longestTime(sentence)

		if (!time) continue

		minutes += time

		if (named) waits.add(named)
	}

	return { minutes: Math.round(minutes), dayBefore, waits: [...waits] }
}

// The hands-on and waiting parts of a recipe's time. Its preparing time is
// hands on at least; what the steps say to wait out is the rest, never more
// than the whole time allows.
export function timeSplit({
	totalMinutes,
	prepMinutes,
	steps,
}: {
	totalMinutes?: number | null | undefined
	prepMinutes?: number | null | undefined
	steps: readonly string[]
}) {
	const waiting = stepWaits(steps)
	const prep = prepMinutes ?? 0

	if (!totalMinutes)
		return {
			activeMinutes: undefined,
			waitingMinutes: waiting.minutes || undefined,
			waits: waiting.waits,
			dayBefore: waiting.dayBefore,
		}

	// Even the longest wait leaves some minutes to put it together.
	const waitingMinutes = Math.min(
		waiting.minutes,
		Math.max(0, totalMinutes - Math.max(prep, 5)),
	)

	return {
		activeMinutes: totalMinutes - waitingMinutes,
		waitingMinutes,
		waits: waitingMinutes ? waiting.waits : [],
		dayBefore: waiting.dayBefore,
	}
}

const words = (text: string, list: readonly string[]) =>
	list.some((word) => new RegExp(`\\b${word}`, 'i').test(text))

// Raw fish and dressed leaves are for the day they are made.
const sameDay = [
	'sushi',
	'sashimi',
	'ceviche',
	'crudo',
	'tartare',
	'poke',
	'carpaccio',
	'green salad',
	'caesar',
]

// Food that holds its shape thawed: wet, slow dishes.
const freezesWell = [
	'soup',
	'stew',
	'chili',
	'curry',
	'braise',
	'ragu',
	'bolognese',
	'meatball',
	'casserole',
	'lasagn',
	'enchilada',
	'dal',
	'daal',
	'dhal',
	'pulled pork',
	'stock',
	'broth',
	'sauce',
	'tagine',
	'gumbo',
	'chowder',
]

const seafood = [
	'fish',
	'salmon',
	'mackerel',
	'cod',
	'tuna',
	'halibut',
	'snapper',
	'tilapia',
	'trout',
	'shrimp',
	'prawn',
	'scallop',
	'mussel',
	'clam',
	'crab',
	'lobster',
	'squid',
	'octopus',
]

// Fried and crisp food keeps, but not well.
const bestFresh = ['fried', 'crispy', 'tempura', 'katsu', 'fritter']

// How long what is left keeps. Cooked food keeps three to four days in the
// fridge, the usual food-safety rule; raw fish and dressed leaves only the
// day they are made.
export function keepingOf(title: string): Keeping {
	if (words(title, sameDay)) return { days: 'the same day', freezes: false }

	if (words(title, bestFresh))
		return { days: 'best the same day', freezes: false }

	// Cooked fish goes soft once thawed, braised or not.
	return {
		days: '3–4 days',
		freezes: words(title, freezesWell) && !words(title, seafood),
	}
}

// Meat and fish by the words a recipe line uses for them, stock and fish
// sauce included.
const meatOrFish =
	/\b(?:chicken|beef|pork|lamb|veal|mutton|goat|bacon|ham|sausages?|chorizo|pancetta|prosciutto|salami|pepperoni|turkey|duck|venison|steak|mince|meatballs?|ribs?|brisket|fish|salmon|tuna|cod|halibut|tilapia|trout|sardines?|anchov\w*|shrimp|prawns?|crab|lobster|scallops?|clams?|mussels?|oysters?|squid|octopus|calamari|gelatin|lard|bonito|dashi)\b/i

// What only an animal gives, other than its meat: milk and what is made of it,
// eggs, and honey. A plant milk, butter or cheese is taken out first.
const fromAnimals =
	/\b(?:milk|buttermilk|butter|ghee|cream|cr[eè]me fra[iî]che|sour cream|half[- ]and[- ]half|cheese|parmesan|parmigiano|pecorino|mozzarella|cheddar|feta|ricotta|mascarpone|paneer|halloumi|yogh?urt|kefir|eggs?|yolks?|egg whites?|mayo|mayonnaise|honey|whey|custard)\b/i

const fromPlants =
	/\b(?:vegan|plant[- ]based|dairy[- ]free|non[- ]dairy|coconut|almond|oat|soy|soya|cashew|rice|hemp|peanut|nut|apple|cocoa|shea|sunflower|seed)\s+(?:milk|butter|cream|cheese|yogh?urt|mayo|mayonnaise)\b|\bflax eggs?\b|\bcream of tartar\b/gi

// What a recipe's page and steps say of its effort.
export function recipeEffort(recipe: {
	title: string
	totalMinutes?: number | null | undefined
	prepMinutes?: number | null | undefined
	servings?: number | null | undefined
	steps: readonly string[]
	foods: readonly string[]
}): RecipeEffort {
	const split = timeSplit(recipe)

	const vegetarian =
		recipe.foods.length > 0 &&
		!recipe.foods.some((line) => meatOrFish.test(line))

	return {
		totalMinutes: recipe.totalMinutes ?? undefined,
		activeMinutes: split.activeMinutes,
		waitingMinutes: split.waitingMinutes,
		waits: split.waits,
		dayBefore: split.dayBefore,
		servings: recipe.servings ?? undefined,
		keeps: keepingOf(recipe.title),
		foods: recipe.foods.length,
		vegetarian,
		vegan:
			vegetarian &&
			!recipe.foods.some((line) =>
				fromAnimals.test(line.replace(fromPlants, '')),
			),
	}
}

// What a shop for it would be: how many foods, how many of them fresh (to be
// bought near the day), and how many parts of the shop they are spread over.
export function shopEffort(toBuy: readonly string[]) {
	const found = toBuy.map((line) => foodOf(line))

	const fresh = found.filter(
		(food) =>
			food?.category === 'vegetables' ||
			food?.category === 'fruit' ||
			food?.category === 'meat' ||
			food?.category === 'dairy',
	).length

	const aisles = new Set(found.map((food) => food?.category ?? 'other')).size

	return { buy: toBuy.length, fresh, aisles }
}

export type EffortLevel = 'low' | 'medium' | 'high'

// How many eat at a time, until a cook can say.
const household = 2

// The work a recipe asks, shared over the meals it makes: a pot of chili for
// eight that freezes is less work a meal than a steak for two, though it
// takes longer to make. Work is hands-on time and the shop (a trip, and a
// little for each food); waiting is not work. Meals are its servings over a
// household, as many as it keeps for: one if it is for the day, three over
// the fridge's days, six if it freezes. Without a known kitchen, a third of
// its foods count as ones to buy, a cupboard's usual share; without
// servings, it is one meal.
export function effortPerMeal(
	effort: Pick<
		RecipeEffort,
		'activeMinutes' | 'totalMinutes' | 'foods' | 'servings' | 'keeps'
	>,
	buy?: number,
) {
	const hands = effort.activeMinutes ?? effort.totalMinutes

	if (hands === undefined) return undefined

	const shopping = buy ?? Math.round(effort.foods / 3)
	const work = hands + (shopping ? 10 + shopping * 2 : 0)

	const lasts = effort.keeps.freezes
		? 6
		: effort.keeps.days === '3–4 days'
			? 3
			: 1

	const meals = Math.max(
		1,
		Math.min(lasts, Math.floor((effort.servings ?? household) / household)),
	)

	return { work, meals, perMeal: Math.round(work / meals) }
}

// The effort in a word, by the work a meal.
export function effortLevel(
	effort: Parameters<typeof effortPerMeal>[0],
	buy?: number,
): EffortLevel | undefined {
	const share = effortPerMeal(effort, buy)

	if (!share) return undefined

	return share.perMeal <= 25 ? 'low' : share.perMeal <= 50 ? 'medium' : 'high'
}
