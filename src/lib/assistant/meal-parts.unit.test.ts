import { describe, expect, test } from 'vite-plus/test'

import {
	countParts,
	cuisineParts,
	formParts,
	mealTags,
	proteinParts,
} from './meal-parts'

describe('meal parts', () => {
	test('reads a title for its cuisine, flavor, protein and dish', () => {
		expect(mealTags('Cajun Chicken Tacos')).toEqual({
			cuisines: ['american south'],
			flavors: ['cajun'],
			proteins: ['chicken'],
			forms: ['tacos'],
		})
		expect(mealTags('Gochujang-Glazed Salmon Rice Bowls')).toMatchObject({
			cuisines: ['korean'],
			flavors: ['gochujang'],
			proteins: ['salmon'],
			forms: ['bowl'],
		})
	})

	test('matches whole words, and plurals', () => {
		expect(mealTags('Shrimp Tacos')?.forms).toEqual(['tacos'])
		expect(mealTags('Turkish eggs')?.proteins).toEqual(['eggs'])
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

	test('counts what each option would leave, and drops the empty ones', () => {
		const tagged = [
			'Gochujang Salmon Bowl',
			'Gochujang Chicken Tacos',
			'Kimchi Fried Rice',
			'Salmon Pasta',
		].flatMap((title) => mealTags(title) ?? [])

		const counts = countParts(tagged, { cuisine: 'korean', protein: 'salmon' })

		expect(counts.total).toBe(1)
		expect(counts.forms).toEqual([{ name: 'bowl', sprite: 'rice', count: 1 }])
		// The proteins count as if protein were not picked yet.
		expect(counts.proteins.map(({ name, count }) => [name, count])).toEqual([
			['chicken', 1],
			['salmon', 1],
		])
		// Kimchi has no salmon recipe, so it is not offered.
		expect(counts.flavors.map(({ name }) => name)).toEqual(['gochujang'])
	})

	test('keeps a picked option with nothing left, so it can be taken off', () => {
		const tagged = ['Salmon Pasta'].flatMap((title) => mealTags(title) ?? [])

		expect(
			countParts(tagged, { protein: 'salmon', form: 'tacos' }).forms,
		).toContainEqual({ name: 'tacos', sprite: 'corn', count: 0 })
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
