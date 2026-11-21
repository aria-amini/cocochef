import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { pantryItems, user } from '@/db/schema'
import { createPantryItemsForUser } from '@/lib/pantry/repository'
import {
	createRecipeForUser,
	deleteRecipeForUser,
} from '@/lib/recipes/repository'

import {
	dropPlanForUser,
	finishCookForUser,
	getPlanForUser,
	listInProgressForUser,
	planCookForUser,
	planIdsForUser,
	unfinishCookForUser,
} from './plans'

async function seedUser(db: Database) {
	const id = crypto.randomUUID()
	await db.insert(user).values({
		id,
		name: 'Cook',
		email: `${id}@example.com`,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return id
}

async function seedRecipe(db: Database, userId: string, title: string) {
	const recipe = await createRecipeForUser(
		userId,
		{
			title,
			ingredients: ['## chili', '½ cup cilantro', '1 tsp salt'],
			steps: ['Cook'],
			finalized: true,
		},
		db,
	)

	if (!recipe) throw new Error('recipe was not made')

	return recipe.id
}

describe('recipes in progress', () => {
	test('a recipe goes in progress with its skips, and saving again replaces them', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')

		expect(await getPlanForUser(userId, chili, db)).toBeNull()

		await planCookForUser(
			userId,
			{ recipeId: chili, skipped: ['½ cup cilantro'] },
			db,
		)

		expect(await getPlanForUser(userId, chili, db)).toMatchObject({
			skipped: ['½ cup cilantro'],
		})

		await planCookForUser(userId, { recipeId: chili, skipped: [] }, db)

		expect(await getPlanForUser(userId, chili, db)).toMatchObject({
			skipped: [],
		})
		expect(await planIdsForUser(userId, db)).toEqual([chili])
	})

	test('lists what is in progress newest first, with each recipe to read', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')
		const soup = await seedRecipe(db, userId, 'soup')

		await planCookForUser(
			userId,
			{ recipeId: chili, skipped: [], plannedAt: new Date('2026-11-01') },
			db,
		)
		await planCookForUser(
			userId,
			{ recipeId: soup, skipped: [], plannedAt: new Date('2026-11-10') },
			db,
		)

		const listed = await listInProgressForUser(userId, db)

		expect(listed.map((plan) => plan.title)).toEqual(['soup', 'chili'])
		expect(listed[0]?.ingredients).toEqual([
			'## chili',
			'½ cup cilantro',
			'1 tsp salt',
		])
	})

	test('a recipe dropped or deleted is no longer in progress', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')
		const soup = await seedRecipe(db, userId, 'soup')

		await planCookForUser(userId, { recipeId: chili, skipped: [] }, db)
		await planCookForUser(userId, { recipeId: soup, skipped: [] }, db)

		expect(await dropPlanForUser(userId, chili, db)).not.toBeNull()
		await deleteRecipeForUser(userId, soup, db)

		expect(await listInProgressForUser(userId, db)).toEqual([])
	})

	test('a plan is only for a recipe the cook can read', async ({ db }) => {
		const userId = await seedUser(db)
		const other = await seedUser(db)

		const theirs = await createRecipeForUser(
			other,
			{ title: 'secret', ingredients: [], steps: [], finalized: true },
			db,
		)

		await expect(
			planCookForUser(userId, { recipeId: theirs?.id ?? '', skipped: [] }, db),
		).rejects.toThrow('Recipe not found')
	})

	test('cooked, it comes off and the food it used up goes out; undo puts both back', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')

		const [cilantro] = await createPantryItemsForUser(
			userId,
			[{ name: 'cilantro', category: 'vegetables', quantity: 2 }],
			db,
		)

		if (!cilantro) throw new Error('pantry item was not made')

		await planCookForUser(
			userId,
			{
				recipeId: chili,
				skipped: ['1 tsp salt'],
				plannedAt: new Date('2026-11-01'),
			},
			db,
		)

		const done = await finishCookForUser(
			userId,
			{ recipeId: chili, usedUp: [cilantro.id] },
			db,
		)

		expect(await getPlanForUser(userId, chili, db)).toBeNull()

		const [after] = await db
			.select()
			.from(pantryItems)
			.where(eq(pantryItems.id, cilantro.id))

		expect(after).toMatchObject({ level: 'out', quantity: 0 })

		await unfinishCookForUser(userId, { recipeId: chili, ...done }, db)

		expect(await getPlanForUser(userId, chili, db)).toEqual({
			skipped: ['1 tsp salt'],
			plannedAt: new Date('2026-11-01'),
		})

		const [back] = await db
			.select()
			.from(pantryItems)
			.where(eq(pantryItems.id, cilantro.id))

		expect(back).toMatchObject({
			level: cilantro.level,
			quantity: 2,
			confirmedAt: cilantro.confirmedAt,
			boughtAt: cilantro.boughtAt,
		})
	})

	test('undo leaves a newer plan and food restocked since alone', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')

		const [cilantro] = await createPantryItemsForUser(
			userId,
			[{ name: 'cilantro', category: 'vegetables' }],
			db,
		)

		if (!cilantro) throw new Error('pantry item was not made')

		await planCookForUser(
			userId,
			{ recipeId: chili, skipped: ['1 tsp salt'] },
			db,
		)

		const done = await finishCookForUser(
			userId,
			{ recipeId: chili, usedUp: [cilantro.id] },
			db,
		)

		// Before undo: planned again, and the cilantro bought again.
		await planCookForUser(userId, { recipeId: chili, skipped: [] }, db)
		await db
			.update(pantryItems)
			.set({ level: 'plenty', quantity: 3 })
			.where(eq(pantryItems.id, cilantro.id))

		await unfinishCookForUser(userId, { recipeId: chili, ...done }, db)

		expect((await getPlanForUser(userId, chili, db))?.skipped).toEqual([])

		const [after] = await db
			.select()
			.from(pantryItems)
			.where(eq(pantryItems.id, cilantro.id))

		expect(after).toMatchObject({ level: 'plenty', quantity: 3 })
	})

	test("cooking never touches another cook's pantry", async ({ db }) => {
		const userId = await seedUser(db)
		const other = await seedUser(db)
		const chili = await seedRecipe(db, userId, 'chili')

		const [theirs] = await createPantryItemsForUser(
			other,
			[{ name: 'cilantro', category: 'vegetables' }],
			db,
		)

		if (!theirs) throw new Error('pantry item was not made')

		const done = await finishCookForUser(
			userId,
			{ recipeId: chili, usedUp: [theirs.id] },
			db,
		)

		expect(done.items).toEqual([])

		const [after] = await db
			.select()
			.from(pantryItems)
			.where(eq(pantryItems.id, theirs.id))

		expect(after?.level).toBe('plenty')
	})
})
