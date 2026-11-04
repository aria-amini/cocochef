import { describe, expect, test } from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { user, mealLogs } from '@/db/schema'
import {
	createPantryItemForUser,
	listPantryForUser,
} from '@/lib/pantry/repository'
import { createRecipeForUser, listShelfForUser } from '@/lib/recipes/repository'

import { moveGuestDataToNewUser } from './link-account'

describe('guest account transfer', () => {
	test('preserves the complete shelf after the guest is deleted', async ({
		db,
	}) => {
		const [fromId, toId, otherId] = [
			crypto.randomUUID(),
			crypto.randomUUID(),
			crypto.randomUUID(),
		]

		await db.insert(user).values(
			[fromId, toId, otherId].map((id) => ({
				id,
				name: 'Cook',
				email: `${id}@example.com`,
				isAnonymous: id === fromId,
				createdAt: new Date(),
				updatedAt: new Date(),
			})),
		)
		const recipe = await createRecipeForUser(fromId, { title: 'soup' }, db)

		if (!recipe) throw new Error('Recipe missing')
		await db.insert(mealLogs).values({
			id: crypto.randomUUID(),
			userId: fromId,
			recipeId: recipe.id,
			cookedAt: new Date(),
		})
		await createPantryItemForUser(
			fromId,
			{ name: 'carrots', quantity: 2, category: 'vegetables' },
			db,
		)
		await createPantryItemForUser(
			toId,
			{ name: 'salt', quantity: 1, category: 'spices' },
			db,
		)
		await createPantryItemForUser(
			otherId,
			{ name: 'rice', quantity: 1, category: 'grains' },
			db,
		)

		await moveGuestDataToNewUser(
			{
				anonymousUser: { user: { id: fromId } },
				newUser: { user: { id: toId } },
			},
			db,
		)
		await db.delete(user).where(eq(user.id, fromId))

		expect(
			(await listPantryForUser(toId, db)).map((item) => item.name).sort(),
		).toEqual(['carrots', 'salt'])
		expect(await listPantryForUser(fromId, db)).toEqual([])
		expect(
			(await listPantryForUser(otherId, db)).map((item) => item.name),
		).toEqual(['rice'])
		const shelf = await listShelfForUser(toId, db)
		expect(shelf.recipes.map((item) => item.id)).toEqual([recipe.id])
		expect(
			await db.select().from(mealLogs).where(eq(mealLogs.userId, toId)),
		).toHaveLength(1)
	})
})
