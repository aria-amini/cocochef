import { describe, expect, test } from 'vite-plus/test'

import {
	countParts,
	cuisineParts,
	coursesOf,
	cuisineTag,
	formParts,
	mealTags,
	placeCuisines,
	proteinParts,
	proteinTag,
	temperatureOf,
} from './meal-parts'

describe('meal parts', () => {
	test('lets a meat outweigh a vegetable word, so the vegetarian pick skips it', () => {
		expect(mealTags('Chicken and Vegetable Stew')?.proteins).toEqual([
			'chicken',
		])
		expect(mealTags('Roasted Vegetable Stew')?.proteins).toContain('vegetarian')
	})

	test('reads a title for its cuisine, flavor, protein and dish', () => {
		expect(mealTags('Cajun Chicken Tacos')).toEqual({
			cuisines: ['north american', 'american'],
			flavors: ['cajun'],
			proteins: ['chicken'],
			forms: ['tacos'],
		})
		expect(mealTags('Gochujang-Glazed Salmon Rice Bowls')).toMatchObject({
			cuisines: ['east asian', 'korean'],
			flavors: ['gochujang'],
			proteins: ['fish', 'salmon'],
			forms: ['bowl'],
		})
	})

	test('names a country with its region, and a shared dish by its region', () => {
		expect(mealTags('Persian Tahdig')?.cuisines).toEqual([
			'middle eastern',
			'persian',
		])
		expect(mealTags('Smoky Hummus')?.cuisines).toEqual(['middle eastern'])
		// Shown by the most it says: the country with its flag, or the region.
		expect(cuisineTag(['middle eastern', 'persian'])).toEqual({
			name: 'persian',
			flag: 'IR',
		})
		expect(cuisineTag(['middle eastern'])).toEqual({
			name: 'middle eastern',
			flag: undefined,
		})
	})

	test('says what kind of dish a title is, an entree unless it says', () => {
		expect(coursesOf('Chocolate Chip Cookies')).toEqual(['dessert'])
		expect(coursesOf('Shepherd’s Pie')).toEqual(['entree'])
		expect(coursesOf('Classic Margarita')).toEqual(['drink'])
		expect(coursesOf('Garlic Mashed Potatoes')).toEqual(['snack'])
		expect(coursesOf('Chicken Tikka Masala')).toEqual(['entree'])
		// Breakfast goes beside a dish's kind, not in place of it.
		expect(coursesOf('Breakfast Burrito')).toEqual(['entree', 'breakfast'])
		expect(coursesOf('Blueberry Muffins')).toEqual(['dessert', 'breakfast'])
	})

	test('says how a dish is eaten, from its words, then its kind', () => {
		expect(temperatureOf('Vanilla Ice Cream')).toBe('frozen')
		expect(temperatureOf('Greek Salad')).toBe('cool')
		// Said outright, it beats what the dish usually is.
		expect(temperatureOf('Warm Potato Salad')).toBe('warm')
		expect(temperatureOf('Hot Crab Dip')).toBe('warm')
		expect(temperatureOf('Iced Tea')).toBe('cool')
		expect(temperatureOf('Grilled Ribeye Steak')).toBe('warm')
		expect(temperatureOf('Classic Margarita')).toBe('cool')
		expect(temperatureOf('Mulled Wine')).toBe('warm')
		expect(temperatureOf('Chocolate Chip Cookies')).toBeUndefined()
		expect(temperatureOf('Apple Pie')).toBe('warm')
	})

	test('places tags saved before regions, under their new names', () => {
		expect(placeCuisines(['american south', 'korean'])).toEqual([
			'north american',
			'american',
			'east asian',
			'korean',
		])
	})

	test('picking a region finds every country in it, listed under it', () => {
		const tagged = [
			'Persian Tahdig',
			'Lebanese Kibbeh',
			'Hummus',
			'Pad Thai',
		].flatMap((title) => mealTags(title) ?? [])

		const counts = countParts(tagged, { cuisine: ['middle eastern'] })

		expect(counts.total).toBe(3)
		expect(
			counts.cuisines.flatMap(({ name, count }) =>
				count ? [[name, count]] : [],
			),
		).toEqual([
			['middle eastern', 3],
			['persian', 1],
			['lebanese', 1],
			['southeast asian', 1],
			['thai', 1],
		])
	})

	test('matches whole words, and plurals', () => {
		expect(mealTags('Shrimp Tacos')?.forms).toEqual(['tacos'])
		expect(mealTags('Turkish eggs')?.proteins).toEqual(['egg'])
		expect(mealTags('Hamburger buns')?.proteins).not.toContain('pork')
	})

	test('reads a burger as a sandwich, not as beef', () => {
		expect(mealTags('Chicken Burger')).toMatchObject({
			proteins: ['chicken'],
			forms: ['sandwich'],
		})
	})

	test('leaves sweets out', () => {
		expect(mealTags('Chocolate Chip Cookies')).toBeUndefined()
		expect(mealTags('Thai coconut cake')).toBeUndefined()
	})

	test('counts what each option would leave, keeping the empty ones at none', () => {
		const tagged = [
			'Gochujang Salmon Bowl',
			'Gochujang Chicken Tacos',
			'Kimchi Fried Rice',
			'Salmon Pasta',
		].flatMap((title) => mealTags(title) ?? [])

		const counts = countParts(tagged, {
			cuisine: ['korean'],
			protein: ['fish'],
		})

		expect(counts.total).toBe(1)
		// Every option stays; those that would leave nothing count none.
		expect(counts.forms.filter(({ count }) => count)).toEqual([
			expect.objectContaining({ name: 'bowl', count: 1 }),
		])
		expect(counts.forms).toContainEqual(
			expect.objectContaining({ name: 'tacos', count: 0 }),
		)
		// The proteins count as if protein were not picked yet.
		expect(
			counts.proteins.flatMap(({ name, count }) =>
				count ? [[name, count]] : [],
			),
		).toEqual([
			['fish', 1],
			['salmon', 1],
			['chicken', 1],
		])
	})

	test('takes any pick within a bubble, and every bubble', () => {
		const tagged = [
			'Persian Chicken',
			'Lebanese Lamb',
			'Thai Chicken',
			'Persian Lamb',
		].flatMap((title) => mealTags(title) ?? [])

		expect(
			countParts(tagged, { cuisine: ['persian', 'thai'], protein: ['chicken'] })
				.total,
		).toBe(2)
	})

	test('names each cuisine once, and gives every country a flag that exists', async () => {
		const { readdir } = await import('node:fs/promises')

		const flags = new Set(
			(await readdir('node_modules/country-flag-icons/3x2')).map((file) =>
				file.replace(/\.svg$/, ''),
			),
		)

		const names = cuisineParts.map(({ name }) => name)

		expect(new Set(names).size).toBe(names.length)
		expect(
			cuisineParts.flatMap(({ name, region, flag }) =>
				region && !(flag && flags.has(flag)) ? [name] : [],
			),
		).toEqual([])
	})

	test('names a cut with its protein, so picking the protein finds it', () => {
		expect(mealTags('Crispy Chicken Thighs')?.proteins).toEqual([
			'chicken',
			'thighs',
		])
		expect(proteinTag(['chicken', 'thighs'])).toBe('thighs')
		expect(
			countParts(
				['Crispy Chicken Thighs', 'Lemon Chicken Breast'].flatMap(
					(title) => mealTags(title) ?? [],
				),
				{ protein: ['chicken'] },
			).total,
		).toBe(2)
	})

	test('keeps a picked option with nothing left, so it can be taken off', () => {
		const tagged = ['Salmon Pasta'].flatMap((title) => mealTags(title) ?? [])

		expect(
			countParts(tagged, { protein: ['fish'], form: ['tacos'] }).forms,
		).toContainEqual(expect.objectContaining({ name: 'tacos', count: 0 }))
	})

	test('gives every part a sprite that exists', async () => {
		const { readdir } = await import('node:fs/promises')

		const sprites = new Set(
			(await readdir('public/sprites/pantry')).map((file) =>
				file.replace(/\.png$/, ''),
			),
		)

		const parts = [
			...cuisineParts.flatMap((cuisine) => [cuisine, ...cuisine.flavors]),
			...proteinParts,
			...formParts,
		]

		for (const part of parts) expect(sprites, part.name).toContain(part.sprite)
	})
})
