import { describe, expect, test } from '@tests/support/fixtures/db'

import { mealTagsByKey } from '@/lib/assistant/meal-tags.server'
import {
	findVisibleRecipeKeys,
	getRecipeForUser,
	popularSharedRecipes,
} from '@/lib/recipes/repository'

import { loadRecipeFixture, readRecipeFixture } from './load'

const viewer = 'fixture-viewer'

describe('recipe fixture', () => {
	test('holds fifty complete, distinct recipes', async () => {
		const fixture = await readRecipeFixture()

		expect(fixture).toHaveLength(50)
		expect(new Set(fixture.map((recipe) => recipe.id)).size).toBe(50)
		expect(new Set(fixture.map((recipe) => recipe.sourceUrl)).size).toBe(50)

		for (const recipe of fixture) {
			expect(recipe.ingredients.length, recipe.title).toBeGreaterThan(0)
			expect(recipe.steps.length, recipe.title).toBeGreaterThan(0)
		}
	})

	test('fills an empty database with recipes anyone can find, and only once', async ({
		db,
	}) => {
		expect(await loadRecipeFixture(db.$client)).toBe(50)
		expect(await loadRecipeFixture(db.$client)).toBe(0)

		const byName = await findVisibleRecipeKeys(viewer, { query: 'kuku' }, db)
		expect(byName.map((match) => match.id)).toEqual(['fixture-27'])

		const byIngredient = await findVisibleRecipeKeys(
			viewer,
			{ query: 'fonio' },
			db,
		)

		expect(byIngredient.map((match) => match.id)).toContain('fixture-33')

		const [tags] = await mealTagsByKey(byName, db)
		expect(tags?.cuisines).toContain('persian')

		const recipe = await getRecipeForUser(viewer, 'fixture-27', db)
		expect(recipe?.ingredients).toHaveLength(12)
		expect(recipe?.steps).toHaveLength(3)

		const popular = await popularSharedRecipes(viewer, 120, db)
		expect(popular).toHaveLength(50)
	})
})
