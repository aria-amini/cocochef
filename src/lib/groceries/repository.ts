import { and, asc, count, eq, isNotNull, isNull, ne } from 'drizzle-orm'

import { type Database, getDb, type Queryable } from '@/db/connection'
import { groceryItems, pantryItems, type StockedWas } from '@/db/schema'
import { pantryNameOf } from '@/lib/groceries/list'
import { findInPantry, foodOf } from '@/lib/pantry/foods'
import {
	createPantryItemsForUser,
	listPantryForUser,
} from '@/lib/pantry/repository'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'

import {
	type GroceryInput,
	groceryFields,
	groceryInputs,
	sameItem,
} from './model'

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

// How many items are still to buy.
export async function countWaitingGroceriesForUser(
	userId: string,
	database: Database = getDb(),
) {
	const [row] = await database
		.select({ waiting: count() })
		.from(groceryItems)
		.where(and(eq(groceryItems.userId, userId), isNull(groceryItems.checkedAt)))

	return row?.waiting ?? 0
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
				id: row.id ?? crypto.randomUUID(),
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

// Into the cart is into the kitchen. A tick tops up the pantry item for the
// line's food, back to enough and dated today, or makes one named for its
// food; the line keeps what that item was. An untick puts it back as it
// stood, or takes away the one the tick made.
export async function setGroceryCheckedForUser(
	userId: string,
	id: string,
	checked: boolean,
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		// Locked, so two ticks at once cannot both stock the food.
		const [line] = await tx
			.select()
			.from(groceryItems)
			.where(and(eq(groceryItems.id, id), eq(groceryItems.userId, userId)))
			.for('update')

		if (!line) return null

		// Ticked twice, or unticked twice, changes nothing more.
		if (!!line.checkedAt === checked) return { item: line, stocked: null }

		if (!checked) {
			if (line.stockedId) {
				// Two lines can fill one pantry item, such as "garlic" and "2 cloves
				// garlic". The first ticked holds what the item was before; while
				// another stays ticked the item stays filled, and the first hands
				// its memory on, so the last untick puts back the item as it was.
				const [next] = await tx
					.select({ id: groceryItems.id, checkedAt: groceryItems.checkedAt })
					.from(groceryItems)
					.where(
						and(
							eq(groceryItems.userId, userId),
							eq(groceryItems.stockedId, line.stockedId),
							ne(groceryItems.id, id),
							isNotNull(groceryItems.checkedAt),
						),
					)
					.orderBy(asc(groceryItems.checkedAt))
					.limit(1)

				if (!next) await putBack(userId, line.stockedId, line.stockedWas, tx)
				else if (
					line.checkedAt &&
					next.checkedAt &&
					line.checkedAt <= next.checkedAt
				)
					await tx
						.update(groceryItems)
						.set({ stockedWas: line.stockedWas })
						.where(eq(groceryItems.id, next.id))
			}

			const [item] = await tx
				.update(groceryItems)
				.set({ checkedAt: null, stockedId: null, stockedWas: null })
				.where(eq(groceryItems.id, id))
				.returning()

			return { item: item ?? line, stocked: null }
		}

		const now = new Date()
		const pantry = await listPantryForUser(userId, tx)
		const kept = findInPantry(line.text, pantry)

		const stocked = kept
			? await tx
					.update(pantryItems)
					.set({
						level: 'plenty',
						quantity: null,
						confirmedAt: now,
						boughtAt: now,
					})
					.where(eq(pantryItems.id, kept.id))
					.returning()
					.then(([row]) => row)
			: (
					await createPantryItemsForUser(
						userId,
						[
							{
								name: pantryNameOf(line.text),
								category: foodOf(line.text)?.category ?? line.category,
							},
						],
						tx,
					)
				)[0]

		const [item] = await tx
			.update(groceryItems)
			.set({
				checkedAt: now,
				stockedId: stocked?.id ?? null,
				stockedWas: kept
					? {
							level: kept.level,
							quantity: kept.quantity,
							confirmedAt: kept.confirmedAt.toISOString(),
							boughtAt: kept.boughtAt.toISOString(),
						}
					: null,
			})
			.where(eq(groceryItems.id, id))
			.returning()

		return {
			item: item ?? line,
			stocked: stocked ? { name: stocked.name, created: !kept } : null,
		}
	})
}

// A pantry item back as it stood before a tick filled it, or gone if the
// tick made it.
async function putBack(
	userId: string,
	pantryId: string,
	was: StockedWas | null,
	database: Queryable,
) {
	const mine = and(eq(pantryItems.id, pantryId), eq(pantryItems.userId, userId))

	if (!was) {
		await database.delete(pantryItems).where(mine)

		return
	}

	await database
		.update(pantryItems)
		.set({
			level: was.level,
			quantity: was.quantity,
			confirmedAt: new Date(was.confirmedAt),
			boughtAt: new Date(was.boughtAt),
		})
		.where(mine)
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
