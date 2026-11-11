import { and, asc, eq, inArray } from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import { pantryItems } from '@/db/schema'
import { groceryLine } from '@/lib/groceries/list'
import { ingredientSubject } from '@/lib/recipes/ingredient-line'

import { findInPantry, foodOf, levelForCount } from './foods'
import {
	pantryCount,
	type PantryCategory,
	type PantryItemInput,
	type PantryLevel,
} from './model'
import { insertPantryItem, insertPantryItems } from './schema'

export async function listPantryForUser(
	userId: string,
	database: Database = getDb(),
) {
	return database
		.select()
		.from(pantryItems)
		.where(eq(pantryItems.userId, userId))
		.orderBy(asc(pantryItems.createdAt))
}

export async function createPantryItemForUser(
	userId: string,
	input: PantryItemInput,
	database: Database = getDb(),
) {
	const data = insertPantryItem.parse(input)

	const [item] = await database
		.insert(pantryItems)
		.values({
			id: crypto.randomUUID(),
			userId,
			...data,
			spriteKey: data.spriteKey ?? null,
			createdAt: new Date(),
			confirmedAt: new Date(),
			boughtAt: new Date(),
		})
		.returning()

	return item
}

export async function createPantryItemsForUser(
	userId: string,
	inputs: PantryItemInput[],
	database: Database = getDb(),
) {
	const rows = insertPantryItems.parse(inputs)
	const now = Date.now()

	return database
		.insert(pantryItems)
		.values(
			rows.map((data, index) => ({
				id: crypto.randomUUID(),
				userId,
				...data,
				spriteKey: data.spriteKey ?? null,
				// One millisecond apart, so the list keeps the order they were added.
				createdAt: new Date(now + index),
				confirmedAt: new Date(now + index),
				boughtAt: new Date(now + index),
			})),
		)
		.returning()
}

// Saying how much is left by level forgets any count, which no longer says
// the same thing.
export async function setPantryItemLevelForUser(
	userId: string,
	id: string,
	level: PantryLevel,
	database: Database = getDb(),
) {
	const [item] = await database
		.update(pantryItems)
		.set({ level, quantity: null, confirmedAt: new Date() })
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

// A count sets the level with it: none left is out.
export async function setPantryItemCountForUser(
	userId: string,
	id: string,
	count: number,
	database: Database = getDb(),
) {
	const [current] = await database
		.select({ name: pantryItems.name })
		.from(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))

	if (!current) return null

	const quantity = pantryCount.parse(count)

	const [item] = await database
		.update(pantryItems)
		.set({
			quantity,
			level: levelForCount(quantity, foodOf(current.name)),
			confirmedAt: new Date(),
		})
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

export async function deletePantryItemForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	const [item] = await database
		.delete(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning({ id: pantryItems.id })

	return item ?? null
}

// Shopping put away: each line bought tops up the pantry item for its food,
// back to plenty, or becomes a new one named for its food ("2 lb short ribs"
// is short ribs), shelved where the grocery list had it. Two lines for one
// food make one item.
export async function restockPantryForUser(
	userId: string,
	bought: { text: string; category: PantryCategory }[],
	database: Database = getDb(),
) {
	const pantry = await listPantryForUser(userId, database)
	const restocked = new Set<string>()
	const fresh: PantryItemInput[] = []

	for (const { text: line, category } of bought) {
		const kept = findInPantry(line, pantry)

		if (kept) {
			restocked.add(kept.id)
			continue
		}

		if (findInPantry(line, fresh)) continue

		const food = foodOf(line)

		fresh.push({
			name: food?.name ?? ingredientSubject(groceryLine(line)).toLowerCase(),
			category: food?.category ?? category,
		})
	}

	if (restocked.size)
		await database
			.update(pantryItems)
			.set({
				level: 'plenty',
				quantity: null,
				confirmedAt: new Date(),
				boughtAt: new Date(),
			})
			.where(
				and(
					eq(pantryItems.userId, userId),
					inArray(pantryItems.id, [...restocked]),
				),
			)

	const added = fresh.length
		? await createPantryItemsForUser(userId, fresh, database)
		: []

	return { restocked: restocked.size, added: added.length }
}

// The cook says they have what a line asks for, though they never logged
// it: the pantry item for its food goes back to plenty, or a new one is made.
// Says which, and what it was, so it can be undone.
export async function markHaveForUser(
	userId: string,
	line: { text: string; category: PantryCategory },
	database: Database = getDb(),
) {
	const kept = findInPantry(
		line.text,
		await listPantryForUser(userId, database),
	)

	await restockPantryForUser(userId, [line], database)

	const after = findInPantry(
		line.text,
		await listPantryForUser(userId, database),
	)

	if (!after) return null

	return kept
		? { id: after.id, created: false, level: kept.level }
		: { id: after.id, created: true, level: null }
}
