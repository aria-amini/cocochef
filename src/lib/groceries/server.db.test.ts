import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { recipes, user } from '@/db/schema'
import {
	createPantryItemsForUser,
	listPantryForUser,
	setPantryItemLevelForUser,
} from '@/lib/pantry/repository'
import { createRecipeForUser } from '@/lib/recipes/repository'

import {
	addGroceriesForUser,
	clearCheckedGroceriesForUser,
	countWaitingGroceriesForUser,
	deleteGroceryForUser,
	leaveGroceryForUser,
	listGroceriesForUser,
	renameGroceryForUser,
	restoreCartForUser,
	setGroceryCheckedForUser,
} from './repository'

async function seedRecipe(db: Database, userId: string, title: string) {
	const recipe = await createRecipeForUser(
		userId,
		{ title, ingredients: ['1 onion'], steps: ['Cook'], finalized: true },
		db,
	)

	if (!recipe) throw new Error('recipe was not made')

	return recipe.id
}

async function seedUser(db: Database) {
	const id = crypto.randomUUID()
	await db.insert(user).values({
		id,
		name: 'Test User',
		email: `${id}@example.com`,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return id
}

describe('groceries', () => {
	test('shelves items by aisle and skips what is already waiting', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const pasta = await seedRecipe(db, userId, 'pasta')

		await addGroceriesForUser(
			userId,
			[{ text: '1 onion' }, { text: '2 tbsp butter', recipeIds: [pasta] }],
			db,
		)

		const again = await addGroceriesForUser(
			userId,
			[{ text: '1 Onion' }, { text: 'milk' }, { text: 'milk' }],
			db,
		)

		expect(again.map((item) => item.text)).toEqual(['milk'])

		const items = await listGroceriesForUser(userId, db)
		expect(items.map((item) => [item.text, item.category])).toEqual([
			['1 onion', 'vegetables'],
			['2 tbsp butter', 'dairy'],
			['milk', 'dairy'],
		])
		expect(items[1]?.recipes).toEqual([{ id: pasta, title: 'pasta' }])
		expect(items[0]?.recipes).toEqual([])
	})

	test('keeps every recipe that asks for a food on its one line', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const pasta = await seedRecipe(db, userId, 'pasta')
		const soup = await seedRecipe(db, userId, 'soup')

		await addGroceriesForUser(
			userId,
			[{ text: '1 onion', recipeIds: [pasta] }],
			db,
		)

		// The same food again, for another recipe: still one line, now for both.
		const again = await addGroceriesForUser(
			userId,
			[{ text: '1 Onion', recipeIds: [soup] }],
			db,
		)

		expect(again).toEqual([])

		const [onion, ...rest] = await listGroceriesForUser(userId, db)
		expect(rest).toEqual([])
		expect(onion?.recipes.map((recipe) => recipe.title).sort()).toEqual([
			'pasta',
			'soup',
		])

		// A recipe that goes takes its mark with it.
		await db.delete(recipes).where(eq(recipes.id, soup))
		expect(
			(await listGroceriesForUser(userId, db))[0]?.recipes.map(
				(recipe) => recipe.title,
			),
		).toEqual(['pasta'])
	})

	test('marks a line only with recipes that are there and the cook can see', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const other = await seedUser(db)
		const pasta = await seedRecipe(db, userId, 'pasta')
		const gone = await seedRecipe(db, userId, 'gone')

		// Written by someone else and never shared.
		const theirs = await createRecipeForUser(
			other,
			{ title: 'secret', ingredients: ['1 onion'], steps: ['Cook'] },
			db,
		)

		await db.delete(recipes).where(eq(recipes.id, gone))
		await addGroceriesForUser(
			userId,
			[{ text: '1 onion', recipeIds: [pasta, gone, theirs!.id] }],
			db,
		)

		expect((await listGroceriesForUser(userId, db))[0]?.recipes).toEqual([
			{ id: pasta, title: 'pasta' },
		])
	})

	test('takes one recipe off a shared line, leaving the rest', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const pasta = await seedRecipe(db, userId, 'pasta')
		const soup = await seedRecipe(db, userId, 'soup')

		await addGroceriesForUser(
			userId,
			[{ text: '2 onions', recipeIds: [pasta, soup] }],
			db,
		)

		const [line] = await listGroceriesForUser(userId, db)

		await leaveGroceryForUser(userId, line!.id, soup, '1 onion', db)

		const [left] = await listGroceriesForUser(userId, db)
		expect(left?.text).toBe('1 onion')
		expect(left?.recipes).toEqual([{ id: pasta, title: 'pasta' }])
	})

	test('keeps the id a list gave an item, so a tick right away lands', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const id = crypto.randomUUID()

		await addGroceriesForUser(userId, [{ id, text: 'milk' }], db)
		await setGroceryCheckedForUser(userId, id, true, db)

		const [milk] = await listGroceriesForUser(userId, db)
		expect(milk?.id).toBe(id)
		expect(milk?.checkedAt).not.toBeNull()
	})

	test('counts only the cook’s items still to buy', async ({ db }) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)

		const [onion] = await addGroceriesForUser(
			userId,
			[{ text: 'onion' }, { text: 'milk' }, { text: 'paprika' }],
			db,
		)

		if (!onion) throw new Error('onion was not added')
		await addGroceriesForUser(otherId, [{ text: 'eggs' }], db)
		await setGroceryCheckedForUser(userId, onion.id, true, db)

		expect(await countWaitingGroceriesForUser(userId, db)).toBe(2)
	})

	test('puts a bought item back on the list when it is needed again', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const [onion] = await addGroceriesForUser(userId, [{ text: 'onion' }], db)

		if (!onion) throw new Error('onion was not added')

		await setGroceryCheckedForUser(userId, onion.id, true, db)
		const added = await addGroceriesForUser(userId, [{ text: 'onion' }], db)

		expect(added).toHaveLength(1)
	})

	test('checks, renames, removes and clears only the cook’s own items', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)

		const [first, second] = await addGroceriesForUser(
			userId,
			[{ text: 'onion' }, { text: 'milk' }],
			db,
		)

		if (!first || !second) throw new Error('items were not added')

		expect(
			await setGroceryCheckedForUser(otherId, first.id, true, db),
		).toBeNull()
		expect(
			(await setGroceryCheckedForUser(userId, first.id, true, db))?.item
				.checkedAt,
		).toBeInstanceOf(Date)

		const renamed = await renameGroceryForUser(userId, second.id, 'paprika', db)
		expect(renamed?.category).toBe('spices')

		await clearCheckedGroceriesForUser(userId, db)
		expect(
			(await listGroceriesForUser(userId, db)).map((item) => item.text),
		).toEqual(['paprika'])

		await deleteGroceryForUser(userId, second.id, db)
		expect(await listGroceriesForUser(userId, db)).toEqual([])
	})

	describe('clearing the cart puts away what the cook picked', () => {
		const levelOf = async (db: Database, userId: string, name: string) =>
			(await listPantryForUser(userId, db)).find((item) => item.name === name)
				?.level

		async function lines(db: Database, userId: string, texts: string[]) {
			const added = await addGroceriesForUser(
				userId,
				texts.map((text) => ({ text })),
				db,
			)

			if (added.length !== texts.length) throw new Error('lines were not added')

			return added
		}

		async function lowGarlic(db: Database, userId: string) {
			const [garlic] = await createPantryItemsForUser(
				userId,
				[{ name: 'garlic', category: 'vegetables' }],
				db,
			)

			if (!garlic) throw new Error('garlic was not kept')
			await setPantryItemLevelForUser(userId, garlic.id, 'low', db)
		}

		test('leaves the kitchen alone while things are only ticked', async ({
			db,
		}) => {
			const userId = await seedUser(db)
			await lowGarlic(db, userId)
			const [garlic, basil] = await lines(db, userId, ['garlic', 'basil'])

			await setGroceryCheckedForUser(userId, garlic!.id, true, db)
			await setGroceryCheckedForUser(userId, basil!.id, true, db)

			expect(await levelOf(db, userId, 'garlic')).toBe('low')
			expect(await levelOf(db, userId, 'basil')).toBeUndefined()
		})

		test('tops up and adds every ticked line, and leaves what is not ticked', async ({
			db,
		}) => {
			const userId = await seedUser(db)
			await lowGarlic(db, userId)

			const [garlic, basil, onion] = await lines(db, userId, [
				'garlic',
				'basil',
				'onion',
			])

			for (const line of [garlic, basil])
				await setGroceryCheckedForUser(userId, line!.id, true, db)

			const done = await clearCheckedGroceriesForUser(userId, db)

			expect(done).toMatchObject({ cleared: 2, restocked: 1, added: 1 })
			expect(await levelOf(db, userId, 'garlic')).toBe('plenty')
			expect(await levelOf(db, userId, 'basil')).toBe('plenty')
			// Not ticked, so it stays to buy.
			expect(await levelOf(db, userId, 'onion')).toBeUndefined()
			expect(
				(await listGroceriesForUser(userId, db)).map((item) => item.text),
			).toEqual([onion!.text])
		})

		test('takes a put-away back: the cart returns and the pantry stands as it did', async ({
			db,
		}) => {
			const userId = await seedUser(db)
			await lowGarlic(db, userId)

			const [garlic, basil] = await lines(db, userId, ['garlic', 'basil'])
			const pasta = await seedRecipe(db, userId, 'pasta')

			await addGroceriesForUser(
				userId,
				[{ text: 'garlic', recipeIds: [pasta] }],
				db,
			)

			for (const line of [garlic, basil])
				await setGroceryCheckedForUser(userId, line!.id, true, db)

			const { undo } = await clearCheckedGroceriesForUser(userId, db)
			expect(await levelOf(db, userId, 'garlic')).toBe('plenty')

			await restoreCartForUser(userId, undo, db)

			// Garlic is low again and basil, made by the put-away, is gone.
			expect(await levelOf(db, userId, 'garlic')).toBe('low')
			expect(await levelOf(db, userId, 'basil')).toBeUndefined()

			const back = await listGroceriesForUser(userId, db)
			expect(back.map((item) => item.text).sort()).toEqual(['basil', 'garlic'])
			expect(back.every((item) => item.checkedAt)).toBe(true)
			// The recipe that asked for garlic is still marked on it.
			expect(
				back
					.find((item) => item.text === 'garlic')
					?.recipes.map((r) => r.title),
			).toEqual(['pasta'])

			// Asked twice, it does not put the lines back twice.
			await restoreCartForUser(userId, undo, db)
			expect(await listGroceriesForUser(userId, db)).toHaveLength(2)
		})

		test('makes one item of two lines for the same food', async ({ db }) => {
			const userId = await seedUser(db)

			const [plain, cloves] = await lines(db, userId, [
				'garlic',
				'2 cloves garlic',
			])

			await setGroceryCheckedForUser(userId, plain!.id, true, db)
			await setGroceryCheckedForUser(userId, cloves!.id, true, db)
			await clearCheckedGroceriesForUser(userId, db)

			expect(
				(await listPantryForUser(userId, db)).filter(
					(item) => item.name === 'garlic',
				),
			).toHaveLength(1)
		})
	})
})
