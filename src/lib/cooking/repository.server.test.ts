import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { and, eq } from 'drizzle-orm'

import { mealLogs, recipes, user } from '@/db/schema'
import {
	createRecipeForUser,
	updateRecipeForUser,
} from '@/lib/recipes/repository'

import {
	getCookingForUser,
	updateCookingForUser,
	listActiveCookingForUser,
} from './repository'

async function setup(db: Database) {
	const userId = crypto.randomUUID()
	await db.insert(user).values({
		id: userId,
		name: 'Cook',
		email: `${userId}@test.com`,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	const recipe = await createRecipeForUser(
		userId,
		{
			title: 'Pasta',
			ingredients: ['## sauce', '1 carrot'],
			steps: ['Cook'],
			finalized: true,
		},
		db,
	)

	if (!recipe) throw new Error('Missing recipe')

	return { userId, recipeId: recipe.id }
}

describe('server cooking progress', () => {
	test('omits a session whose recipe is no longer visible', async ({ db }) => {
		const { userId, recipeId } = await setup(db)
		const other = await setup(db)
		await updateCookingForUser(userId, { recipeId, action: 'start' }, db)
		await db
			.update(recipes)
			.set({ userId: other.userId, finalizedAt: null })
			.where(eq(recipes.id, recipeId))
		expect(await getCookingForUser(userId, recipeId, db)).toBeNull()
		expect(await listActiveCookingForUser(userId, db)).toEqual([])
	})

	test('persists progress and ends without recording a meal', async ({
		db,
	}) => {
		const { userId, recipeId } = await setup(db)
		expect(await getCookingForUser(userId, recipeId, db)).toBeNull()

		const started = await updateCookingForUser(
			userId,
			{ recipeId, action: 'start' },
			db,
		)

		expect(await listActiveCookingForUser(userId, db)).toMatchObject([
			{ recipeId, title: 'Pasta', steps: 1 },
		])
		expect(await listActiveCookingForUser('someone-else', db)).toEqual([])
		await Promise.all(
			['i1', 's0'].map((item) =>
				updateCookingForUser(
					userId,
					{ recipeId, action: 'check', item, done: true },
					db,
				),
			),
		)
		expect(
			(await getCookingForUser(userId, recipeId, db))?.checked.sort(),
		).toEqual(['i1', 's0'])
		expect((await getCookingForUser(userId, recipeId, db))?.startedAt).toEqual(
			started?.startedAt,
		)
		await updateCookingForUser(userId, { recipeId, action: 'pause' }, db)
		expect(await listActiveCookingForUser(userId, db)).toEqual([])
		expect(await getCookingForUser(userId, recipeId, db)).toMatchObject({
			active: false,
			checked: expect.arrayContaining(['i1', 's0']),
		})
		await updateCookingForUser(userId, { recipeId, action: 'start' }, db)
		await Promise.all(
			[0, 1].map(() =>
				updateCookingForUser(userId, { recipeId, action: 'finish' }, db),
			),
		)
		expect(await getCookingForUser(userId, recipeId, db)).toBeNull()
		expect(
			await db
				.select()
				.from(mealLogs)
				.where(
					and(eq(mealLogs.userId, userId), eq(mealLogs.recipeId, recipeId)),
				),
		).toHaveLength(0)
	})

	test('rejects private recipes, headings, and checks outside cooking; invalidates progress after an edit', async ({
		db,
	}) => {
		const { userId, recipeId } = await setup(db)
		await expect(
			updateCookingForUser('someone-else', { recipeId, action: 'start' }, db),
		).rejects.toThrow('Recipe not found')
		await expect(
			updateCookingForUser(
				userId,
				{ recipeId, action: 'check', item: 'i1', done: true },
				db,
			),
		).rejects.toThrow('Start cooking')
		await updateCookingForUser(userId, { recipeId, action: 'start' }, db)
		await expect(
			updateCookingForUser(
				userId,
				{ recipeId, action: 'check', item: 'i0', done: true },
				db,
			),
		).rejects.toThrow('Cooking item not found')
		await updateCookingForUser(
			userId,
			{ recipeId, action: 'check', item: 'i1', done: true },
			db,
		)
		await updateRecipeForUser(
			userId,
			{
				id: recipeId,
				title: 'Pasta',
				ingredients: ['2 carrots'],
				steps: ['Cook'],
				notes: null,
			},
			db,
		)
		expect(await getCookingForUser(userId, recipeId, db)).toBeNull()
		expect(
			await updateCookingForUser(userId, { recipeId, action: 'start' }, db),
		).toMatchObject({ active: true, checked: [] })
	})
})
