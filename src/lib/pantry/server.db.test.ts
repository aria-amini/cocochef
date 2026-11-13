import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { pantryItems, user } from '@/db/schema'

import {
	createPantryItemForUser,
	createPantryItemsForUser,
	deletePantryItemForUser,
	listPantryForUser,
	markHaveForUser,
	restockPantryForUser,
	restorePantryItemForUser,
	setPantryItemCountForUser,
	setPantryItemLevelForUser,
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

describe('pantry', () => {
	test('creates items and lists them in the order they were added', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const carrots = await createPantryItemForUser(
			userId,
			{ name: 'carrots', quantity: 7, category: 'vegetables' },
			db,
		)

		await createPantryItemForUser(
			userId,
			{ name: 'salt', quantity: 1, category: 'spices' },
			db,
		)
		expect(carrots?.quantity).toBe(7)

		const items = await listPantryForUser(userId, db)
		expect(items).toHaveLength(2)
		expect(items[0]?.category).toBe('vegetables')
		expect(items[1]?.category).toBe('spices')
	})

	test('starts with plenty, and keeps a level or a count', async ({ db }) => {
		const userId = await seedUser(db)

		const salt = await createPantryItemForUser(
			userId,
			{ name: 'salt', category: 'spices' },
			db,
		)

		const eggs = await createPantryItemForUser(
			userId,
			{ name: 'eggs', quantity: 12, category: 'dairy' },
			db,
		)

		if (!salt || !eggs) throw new Error('items were not created')

		expect(salt).toMatchObject({ level: 'plenty', quantity: null })
		expect(
			await setPantryItemLevelForUser(userId, salt.id, 'low', db),
		).toMatchObject({ level: 'low', quantity: null })

		// A count says the level: three of a dozen eggs is running low.
		expect(
			await setPantryItemCountForUser(userId, eggs.id, 3, db),
		).toMatchObject({ level: 'low', quantity: 3 })
		expect(
			await setPantryItemCountForUser(userId, eggs.id, 0, db),
		).toMatchObject({ level: 'out', quantity: 0 })

		// Some again after none: how many is no longer known.
		expect(
			await setPantryItemLevelForUser(userId, eggs.id, 'plenty', db),
		).toMatchObject({ level: 'plenty', quantity: null })

		// A count kept stays when the cook says low; out is none left.
		await setPantryItemCountForUser(userId, eggs.id, 6, db)
		expect(
			await setPantryItemLevelForUser(userId, eggs.id, 'low', db),
		).toMatchObject({ level: 'low', quantity: 6 })
		expect(
			await setPantryItemLevelForUser(userId, eggs.id, 'out', db),
		).toMatchObject({ level: 'out', quantity: 0 })

		for (const count of [-3, 1.5, 10000]) {
			await expect(
				setPantryItemCountForUser(userId, eggs.id, count, db),
			).rejects.toThrow()
		}
	})

	test('adds many items in one batch', async ({ db }) => {
		const userId = await seedUser(db)

		const created = await createPantryItemsForUser(
			userId,
			[
				{ name: 'cumin', quantity: 1, category: 'spices' },
				{ name: ' paprika ', quantity: 1, category: 'spices' },
				{ name: 'eggs', quantity: 12, category: 'dairy' },
			],
			db,
		)

		expect(created.map((item) => item.name)).toEqual([
			'cumin',
			'paprika',
			'eggs',
		])
		expect(
			(await listPantryForUser(userId, db)).map((item) => item.name),
		).toEqual(['cumin', 'paprika', 'eggs'])

		await expect(createPantryItemsForUser(userId, [], db)).rejects.toThrow()
		await expect(
			createPantryItemsForUser(
				userId,
				[
					{ name: 'salt', quantity: 1, category: 'spices' },
					{ name: '', quantity: 1, category: 'spices' },
				],
				db,
			),
		).rejects.toThrow()
		expect(await listPantryForUser(userId, db)).toHaveLength(3)
	})

	test('scopes the pantry to the user', async ({ db }) => {
		const userId = await seedUser(db)

		const item = await createPantryItemForUser(
			userId,
			{ name: 'carrots', quantity: 2, category: 'vegetables' },
			db,
		)

		if (!item) throw new Error('item was not created')

		expect(await listPantryForUser('user-2', db)).toHaveLength(0)
		expect(await setPantryItemCountForUser('user-2', item.id, 9, db)).toBeNull()
		expect(
			await setPantryItemLevelForUser('user-2', item.id, 'out', db),
		).toBeNull()
		expect(await deletePantryItemForUser('user-2', item.id, db)).toBeNull()
		expect(await listPantryForUser(userId, db)).toHaveLength(1)
	})

	test('deletes owned items', async ({ db }) => {
		const userId = await seedUser(db)

		const item = await createPantryItemForUser(
			userId,
			{ name: 'milk', quantity: 1, category: 'dairy' },
			db,
		)

		if (!item) throw new Error('item was not created')

		const deleted = await deletePantryItemForUser(userId, item.id, db)
		expect(deleted?.id).toBe(item.id)
		expect(await listPantryForUser(userId, db)).toHaveLength(0)

		// Undo puts it back as it was: its id, count and dates.
		await restorePantryItemForUser(
			userId,
			{
				id: item.id,
				name: item.name,
				category: item.category,
				level: item.level,
				quantity: item.quantity,
				createdAt: item.createdAt,
				confirmedAt: item.confirmedAt,
				boughtAt: item.boughtAt,
			},
			db,
		)
		expect(await listPantryForUser(userId, db)).toEqual([item])
	})

	test('puts shopping away: tops up what is kept, adds the rest', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const garlic = await createPantryItemForUser(
			userId,
			{ name: 'garlic', category: 'vegetables', level: 'out' },
			db,
		)

		expect(
			await restockPantryForUser(
				userId,
				[
					{ text: '1 head garlic', category: 'vegetables' },
					{ text: '2 lb bone-in short ribs', category: 'meat' },
					{ text: '1 can chickpeas', category: 'cans' },
					{ text: 'chickpeas', category: 'cans' },
				],
				db,
			),
		).toEqual({ restocked: 1, added: 2 })

		const items = await listPantryForUser(userId, db)

		expect(items.find((item) => item.id === garlic?.id)?.level).toBe('plenty')
		expect(items.map((item) => [item.name, item.category])).toEqual([
			['garlic', 'vegetables'],
			['short ribs', 'meat'],
			['chickpeas', 'cans'],
		])
	})

	test('marks a line as had, saying how to undo it', async ({ db }) => {
		const userId = await seedUser(db)
		const old = new Date('2026-01-01T00:00:00Z')

		const eggs = await createPantryItemForUser(
			userId,
			{ name: 'eggs', category: 'dairy', level: 'out' },
			db,
		)

		if (!eggs) throw new Error('item was not created')
		await db
			.update(pantryItems)
			.set({ confirmedAt: old })
			.where(eq(pantryItems.id, eggs.id))

		expect(
			await markHaveForUser(
				userId,
				{ text: '3 large eggs', category: 'dairy' },
				db,
			),
		).toEqual({ id: eggs.id, created: false, level: 'out' })

		const avocado = await markHaveForUser(
			userId,
			{ text: '1 ripe avocado', category: 'vegetables' },
			db,
		)

		expect(avocado).toMatchObject({ created: true, level: null })

		const items = await listPantryForUser(userId, db)
		const kept = items.find((item) => item.id === eggs.id)

		expect(kept?.level).toBe('plenty')
		expect(kept?.confirmedAt.getTime()).toBeGreaterThan(old.getTime())
		expect(items.map((item) => item.name)).toEqual(['eggs', 'avocados'])
	})
})
