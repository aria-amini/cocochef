import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'

import { user } from '@/db/schema'

import {
	addGroceriesForUser,
	clearCheckedGroceriesForUser,
	countWaitingGroceriesForUser,
	deleteGroceryForUser,
	listGroceriesForUser,
	renameGroceryForUser,
	setGroceryCheckedForUser,
} from './repository'

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

		await addGroceriesForUser(
			userId,
			[{ text: '1 onion' }, { text: '2 tbsp butter', recipeTitle: 'pasta' }],
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
		expect(items[1]?.recipeTitle).toBe('pasta')
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
})
