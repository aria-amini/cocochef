import { and, eq, inArray } from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import { mealLogs, pantryItems, recipes, shelfRecipes } from '@/db/schema'

interface LinkAccountParams {
	anonymousUser: { user: { id: string } }
	newUser: { user: { id: string } }
}

// better-auth deletes the anonymous user row on link, so guest data must be
// re-pointed at the real account first or the shelf vanishes at signup.
export async function moveGuestDataToNewUser(
	{ anonymousUser, newUser }: LinkAccountParams,
	database: Database = getDb(),
) {
	const fromId = anonymousUser.user.id
	const toId = newUser.user.id

	if (fromId === toId) return

	await database.transaction(async (tx) => {
		// A recipe both accounts saved keeps the account's shelf row.
		await tx
			.delete(shelfRecipes)
			.where(
				and(
					eq(shelfRecipes.userId, fromId),
					inArray(
						shelfRecipes.recipeId,
						tx
							.select({ recipeId: shelfRecipes.recipeId })
							.from(shelfRecipes)
							.where(eq(shelfRecipes.userId, toId)),
					),
				),
			)

		for (const table of [recipes, shelfRecipes, mealLogs, pantryItems]) {
			await tx
				.update(table)
				.set({ userId: toId })
				.where(eq(table.userId, fromId))
		}
	})
}
