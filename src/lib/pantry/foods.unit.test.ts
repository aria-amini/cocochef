import { describe, expect, test } from 'vite-plus/test'

import {
	findInPantry,
	foodOf,
	shelfLife,
	shelfState,
	levelForCount,
	neverBuy,
} from './foods'

describe('foodOf', () => {
	test('finds the food a recipe line names', () => {
		expect(foodOf('2 cloves garlic, minced')?.name).toBe('garlic')
		expect(foodOf('1 tsp kosher salt')?.name).toBe('salt')
		expect(foodOf('3 large eggs')?.name).toBe('eggs')
	})

	test('prefers the most specific food', () => {
		expect(foodOf('1 can coconut milk')?.name).toBe('coconut milk')
		expect(foodOf('2 tbsp tomato paste')?.name).toBe('tomato paste')
		expect(foodOf('1 (15-ounce) can chickpeas')?.name).toBe('chickpeas')
	})

	test('reads a food named as a modifier as not that food', () => {
		expect(foodOf('½ low-salt vegetable stock cube')?.name).toBe(
			'vegetable broth',
		)
		expect(foodOf('1 cup reduced-sodium chicken broth')?.name).toBe(
			'chicken broth',
		)
		expect(foodOf('2 tbsp sugar-free maple syrup')?.name).toBe('maple syrup')
		expect(foodOf('1 cup low fat milk')?.name).toBe('milk')
		expect(foodOf('1 cup half-and-half')?.name).toBe('half and half')
	})

	test('knows nothing of a food outside the catalog', () => {
		expect(foodOf('2 lb bone-in short ribs')).toBeUndefined()
	})

	test('keeps bulk food by level and counts eggs in packs', () => {
		expect(foodOf('1 cup sugar')).toMatchObject({ kind: 'stock', packs: [] })
		expect(foodOf('eggs')).toMatchObject({ kind: 'count', packs: [12, 18] })
	})

	test('keeps staples apart from food bought for one meal', () => {
		expect(foodOf('soy sauce')?.staple).toBe(true)
		expect(foodOf('1 yellow onion')?.staple).toBe(true)
		expect(foodOf('1 lb salmon')?.staple).toBe(false)
		expect(foodOf('a bunch of cilantro')?.staple).toBe(false)
		expect(foodOf('1 cup ricotta')?.staple).toBe(false)
	})
})

describe('neverBuy', () => {
	test.each([
		'water',
		'1 cup water',
		'½ cup warm water',
		'2 cups boiling water, divided',
		'1/4 cup reserved pasta water',
		'ice water',
		'Ice cubes, to serve',
		'water as needed',
		'1 tbsp cold water plus more',
	])('skips %s', (line) => {
		expect(neverBuy(line)).toBe(true)
	})

	test.each([
		'coconut water',
		'1 tbsp rose water',
		'sparkling water',
		'watermelon',
		'ice cream',
		'salt and water',
		'1 cup chicken broth or water',
	])('buys %s', (line) => {
		expect(neverBuy(line)).toBe(false)
	})
})

describe('findInPantry', () => {
	const pantry = [
		{ name: 'garlic', level: 'plenty' as const },
		{ name: 'milk', level: 'low' as const },
		{ name: 'short ribs', level: 'out' as const },
	]

	test('finds the same food however the line reads', () => {
		expect(findInPantry('2 cloves garlic, minced', pantry)?.name).toBe('garlic')
		expect(findInPantry('1 cup whole milk', pantry)?.name).toBe('milk')
	})

	test('never takes one food for another inside its name', () => {
		expect(findInPantry('1 can coconut milk', pantry)).toBeUndefined()
	})

	test('matches food outside the catalog by its words', () => {
		expect(findInPantry('3 lb bone-in short ribs', pantry)?.name).toBe(
			'short ribs',
		)
	})
})

describe('levelForCount', () => {
	test('reads a dozen eggs by the dozen, and others one by one', () => {
		const eggs = foodOf('eggs')

		expect(levelForCount(0, eggs)).toBe('out')
		expect(levelForCount(3, eggs)).toBe('low')
		expect(levelForCount(4, eggs)).toBe('plenty')
		expect(levelForCount(1, foodOf('lemons'))).toBe('low')
		expect(levelForCount(2, foodOf('lemons'))).toBe('plenty')
	})
})

describe('shelfState', () => {
	const now = new Date('2026-11-11T12:00:00Z')
	const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

	const kept = (
		name: string,
		category: Parameters<typeof shelfState>[0]['category'],
		bought: number,
		confirmed = bought,
	) =>
		shelfState(
			{
				name,
				category,
				boughtAt: daysAgo(bought),
				confirmedAt: daysAgo(confirmed),
			},
			now,
		)

	test('estimates how long each food keeps', () => {
		expect(shelfLife('honey', 'grains')).toBe(3650)
		expect(shelfLife('ground cumin', 'spices')).toBe(730)
		expect(shelfLife('salmon fillets', 'meat')).toBe(2)
		expect(shelfLife('2 lb short ribs', 'meat')).toBe(3)
	})

	test("keeps what is stored frozen for a frozen food's time, not the fresh one's", () => {
		expect(shelfLife('frozen salmon', 'frozen')).toBeGreaterThan(30)
		expect(shelfLife('frozen salmon', 'frozen')).toBe(
			shelfLife('frozen peas', 'frozen'),
		)
	})

	test('trusts what keeps until the cook last said so long ago', () => {
		expect(kept('soy sauce', 'sauces', 300, 90)).toMatchObject({
			state: 'fresh',
			spoils: false,
			daysLeft: 430,
		})
		expect(kept('soy sauce', 'sauces', 300, 200).state).toBe('stale')
	})

	test('counts what spoils from the day it was bought', () => {
		expect(kept('lemons', 'fruit', 10, 0)).toMatchObject({
			state: 'fresh',
			spoils: true,
			daysLeft: 11,
			boughtDaysAgo: 10,
		})
		expect(kept('lemons', 'fruit', 30, 0).state).toBe('stale')
	})

	test('lets food bought for a meal go once its days are up', () => {
		expect(kept('avocados', 'vegetables', 3)).toMatchObject({
			state: 'fresh',
			daysLeft: 1,
		})
		expect(kept('avocados', 'vegetables', 6).state).toBe('expired')
		expect(kept('short ribs', 'meat', 6).state).toBe('expired')
	})
})
