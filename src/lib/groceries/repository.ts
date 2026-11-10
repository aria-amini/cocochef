import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import { groceryItems } from '@/db/schema'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'

import { type GroceryInput, groceryFields, groceryInputs } from './model'

const sameItem = (text: string) => text.trim().toLowerCase()

export async function listGroceriesForUser(
	userId: string,
	database: Database = getDb(),
) {
	return database
		.select()
		.from(groceryItems)
		.where(eq(groceryItems.userId, userId))
		.orderBy(asc(groceryItems.createdAt))
}

// Adds what is not already waiting on the list, each shelved in its aisle.
// A line already in the cart goes back on: it is needed again.
export async function addGroceriesForUser(
	userId: string,
	inputs: GroceryInput[],
	database: Database = getDb(),
) {
	const rows = groceryInputs.parse(inputs)

	const waiting = await database
		.select({ text: groceryItems.text })
		.from(groceryItems)
		.where(and(eq(groceryItems.userId, userId), isNull(groceryItems.checkedAt)))

	const seen = new Set(waiting.map((item) => sameItem(item.text)))

	const fresh = rows.filter((row) => {
		const key = sameItem(row.text)

		if (seen.has(key)) return false
		seen.add(key)

		return true
	})

	if (!fresh.length) return []
	const now = Date.now()

	return database
		.insert(groceryItems)
		.values(
			fresh.map((row, index) => ({
				id: crypto.randomUUID(),
				userId,
				text: row.text,
				category: ingredientCategory(row.text),
				recipeId: row.recipeId ?? null,
				recipeTitle: row.recipeTitle ?? null,
				// One millisecond apart, so the list keeps the order they came in.
				createdAt: new Date(now + index),
			})),
		)
		.returning()
}

export async function setGroceryCheckedForUser(
	userId: string,
	id: string,
	checked: boolean,
	database: Database = getDb(),
) {
	const [item] = await database
		.update(groceryItems)
		.set({ checkedAt: checked ? new Date() : null })
		.where(and(eq(groceryItems.id, id), eq(groceryItems.userId, userId)))
		.returning()

	return item ?? null
}

// A renamed line may belong in another aisle.
export async function renameGroceryForUser(
	userId: string,
	id: string,
	text: string,
	database: Database = getDb(),
) {
	const name = groceryFields.text.parse(text)

	const [item] = await database
		.update(groceryItems)
		.set({ text: name, category: ingredientCategory(name) })
		.where(and(eq(groceryItems.id, id), eq(groceryItems.userId, userId)))
		.returning()

	return item ?? null
}

export async function deleteGroceryForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	await database
		.delete(groceryItems)
		.where(and(eq(groceryItems.id, id), eq(groceryItems.userId, userId)))
}

export async function clearCheckedGroceriesForUser(
	userId: string,
	database: Database = getDb(),
) {
	await database
		.delete(groceryItems)
		.where(
			and(eq(groceryItems.userId, userId), isNotNull(groceryItems.checkedAt)),
		)
}
