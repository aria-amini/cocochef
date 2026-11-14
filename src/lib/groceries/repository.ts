import {
	and,
	asc,
	count,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
} from 'drizzle-orm'

import { type Database, getDb, type Queryable } from '@/db/connection'
import { groceryItems, pantryItems, type StockedWas } from '@/db/schema'
import { restockPantryForUser } from '@/lib/pantry/repository'
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
		if (!!line.checkedAt === checked) return { item: line }

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

			return { item: item ?? line }
		}

		// A tick only means it is in the cart; the kitchen hears about it when
		// the cart is cleared and the cook says what to put away.
		const [item] = await tx
			.update(groceryItems)
			.set({ checkedAt: new Date() })
			.where(eq(groceryItems.id, id))
			.returning()

		return { item: item ?? line }
	})
}

// A pantry item back as it stood before a tick filled it, or gone if the
// tick made it. Ticks no longer fill the pantry, but lines ticked before
// that changed still remember what they filled.
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

// The cart put away: the lines the cook picked go into the pantry, topping
// up what is there or adding what is not, and every ticked line leaves the
// list. A line that already filled the pantry when it was ticked is not
// counted twice.
export async function clearCheckedGroceriesForUser(
	userId: string,
	stock: string[],
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		const ticked = await tx
			.select()
			.from(groceryItems)
			.where(
				and(eq(groceryItems.userId, userId), isNotNull(groceryItems.checkedAt)),
			)
			// Locked, so two clears at once cannot both put the same line away.
			.for('update')

		const picked = new Set(stock)

		const bought = ticked.filter(
			(line) => picked.has(line.id) && !line.stockedId,
		)

		const stocked = bought.length
			? await restockPantryForUser(
					userId,
					bought.map(({ text, category }) => ({ text, category })),
					tx,
				)
			: { restocked: 0, added: 0 }

		// Only the lines read above: one ticked meanwhile was never offered.
		if (ticked.length)
			await tx.delete(groceryItems).where(
				and(
					eq(groceryItems.userId, userId),
					inArray(
						groceryItems.id,
						ticked.map((line) => line.id),
					),
				),
			)

		return { cleared: ticked.length, ...stocked }
	})
}
