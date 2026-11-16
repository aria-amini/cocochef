import {
	and,
	asc,
	count,
	eq,
	getTableColumns,
	inArray,
	isNotNull,
	isNull,
	ne,
} from 'drizzle-orm'

import { type Database, getDb, type Queryable } from '@/db/connection'
import {
	groceryItemRecipes,
	groceryItems,
	pantryItems,
	recipes,
	type StockedWas,
} from '@/db/schema'
import {
	listPantryForUser,
	restockPantryForUser,
} from '@/lib/pantry/repository'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { visibleTo } from '@/lib/recipes/repository'

import {
	type GroceryInput,
	groceryFields,
	groceryInputs,
	sameItem,
} from './model'

// A line's columns, without the retired recipe ones it still carries.
const {
	recipeId: _recipeId,
	recipeTitle: _recipeTitle,
	...listed
} = getTableColumns(groceryItems)

// The list, each line with the recipes that are asking for it.
export async function listGroceriesForUser(
	userId: string,
	database: Database = getDb(),
) {
	const items = await database
		.select(listed)
		.from(groceryItems)
		.where(eq(groceryItems.userId, userId))
		.orderBy(asc(groceryItems.createdAt))

	if (!items.length) return items.map((item) => ({ ...item, recipes: [] }))

	const marks = await database
		.select({
			itemId: groceryItemRecipes.itemId,
			id: recipes.id,
			title: recipes.title,
		})
		.from(groceryItemRecipes)
		.innerJoin(recipes, eq(recipes.id, groceryItemRecipes.recipeId))
		.where(
			inArray(
				groceryItemRecipes.itemId,
				items.map((item) => item.id),
			),
		)

	return items.map((item) => ({
		...item,
		recipes: marks
			.filter((mark) => mark.itemId === item.id)
			.map(({ id, title }) => ({ id, title })),
	}))
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
// A food already waiting is not added twice, but the recipe that asked for it
// again is kept with it. A line already in the cart goes back on: it is
// needed again.
export async function addGroceriesForUser(
	userId: string,
	inputs: GroceryInput[],
	database: Database = getDb(),
) {
	const rows = groceryInputs.parse(inputs)

	return database.transaction(async (tx) => {
		const waiting = await tx
			.select({ id: groceryItems.id, text: groceryItems.text })
			.from(groceryItems)
			.where(
				and(eq(groceryItems.userId, userId), isNull(groceryItems.checkedAt)),
			)

		const seen = new Map(waiting.map((item) => [sameItem(item.text), item.id]))
		const fresh: (GroceryInput & { id: string })[] = []
		const marks: { itemId: string; recipeId: string }[] = []

		for (const row of rows) {
			const key = sameItem(row.text)
			const kept = seen.get(key)

			if (kept) {
				for (const recipeId of row.recipeIds ?? [])
					marks.push({ itemId: kept, recipeId })

				continue
			}

			const id = row.id ?? crypto.randomUUID()

			seen.set(key, id)
			fresh.push({ ...row, id })

			for (const recipeId of row.recipeIds ?? [])
				marks.push({ itemId: id, recipeId })
		}

		const now = Date.now()

		const added = fresh.length
			? await tx
					.insert(groceryItems)
					.values(
						fresh.map((row, index) => ({
							id: row.id,
							userId,
							text: row.text,
							category: ingredientCategory(row.text),
							// One millisecond apart, so the list keeps the order they came in.
							createdAt: new Date(now + index),
						})),
					)
					.returning()
			: []

		await markRecipes(tx, userId, marks)

		return added
	})
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

// One recipe gives up its share of a line two recipes have: the line keeps
// the rest of the amount, and no longer says it's for that recipe.
export async function leaveGroceryForUser(
	userId: string,
	id: string,
	recipeId: string,
	text: string,
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		const name = groceryFields.text.parse(text)

		const [item] = await tx
			.update(groceryItems)
			.set({ text: name, category: ingredientCategory(name) })
			.where(and(eq(groceryItems.id, id), eq(groceryItems.userId, userId)))
			.returning()

		if (!item) return null

		await tx
			.delete(groceryItemRecipes)
			.where(
				and(
					eq(groceryItemRecipes.itemId, id),
					eq(groceryItemRecipes.recipeId, recipeId),
				),
			)

		return item
	})
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

// What a put-away did, kept for a moment so it can be taken back: the lines
// that left the list, the pantry items it topped up and how they stood, and
// the ones it made. Dates are ISO strings, since it travels to the cook and
// back.
export type PutAway = {
	lines: {
		id: string
		text: string
		recipes: string[]
		checkedAt: string
		createdAt: string
	}[]
	topped: { id: string; was: StockedWas }[]
	made: string[]
}

// The cart put away: every ticked line goes into the pantry, topping up what
// is there or adding what is not, and leaves the list. A line that already
// filled the pantry when it was ticked is not counted twice.
export async function clearCheckedGroceriesForUser(
	userId: string,
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

		const marks = ticked.length
			? await tx
					.select()
					.from(groceryItemRecipes)
					.where(
						inArray(
							groceryItemRecipes.itemId,
							ticked.map((line) => line.id),
						),
					)
			: []

		const bought = ticked.filter((line) => !line.stockedId)
		const before = bought.length ? await listPantryForUser(userId, tx) : []

		const stocked = bought.length
			? await restockPantryForUser(
					userId,
					bought.map(({ text, category }) => ({ text, category })),
					tx,
				)
			: { restocked: 0, added: 0, restockedIds: [], addedIds: [] }

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

		const undo: PutAway = {
			lines: ticked.map((line) => ({
				id: line.id,
				text: line.text,
				recipes: marks
					.filter((mark) => mark.itemId === line.id)
					.map((mark) => mark.recipeId),
				checkedAt: (line.checkedAt ?? new Date()).toISOString(),
				createdAt: line.createdAt.toISOString(),
			})),
			topped: stocked.restockedIds.flatMap((id) => {
				const was = before.find((item) => item.id === id)

				return was
					? [
							{
								id,
								was: {
									level: was.level,
									quantity: was.quantity,
									confirmedAt: was.confirmedAt.toISOString(),
									boughtAt: was.boughtAt.toISOString(),
								},
							},
						]
					: []
			}),
			made: stocked.addedIds,
		}

		return {
			cleared: ticked.length,
			restocked: stocked.restocked,
			added: stocked.added,
			undo,
		}
	})
}

// A put-away taken back: the pantry items it topped up stand as they did and
// the ones it made go, and the lines return to the cart as they were.
export async function restoreCartForUser(
	userId: string,
	undo: PutAway,
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		for (const { id, was } of undo.topped) await putBack(userId, id, was, tx)

		if (undo.made.length)
			await tx
				.delete(pantryItems)
				.where(
					and(
						eq(pantryItems.userId, userId),
						inArray(pantryItems.id, undo.made),
					),
				)

		if (!undo.lines.length) return []

		const back = await tx
			.insert(groceryItems)
			.values(
				undo.lines.map((line) => ({
					id: line.id,
					userId,
					text: line.text,
					category: ingredientCategory(line.text),
					checkedAt: new Date(line.checkedAt),
					createdAt: new Date(line.createdAt),
				})),
			)
			.onConflictDoNothing()
			.returning()

		// Only the recipes still there, and only for the lines that came back.
		const came = new Set(back.map((line) => line.id))

		const wanted = undo.lines
			.filter((line) => came.has(line.id))
			.flatMap((line) =>
				line.recipes.map((recipeId) => ({ itemId: line.id, recipeId })),
			)

		await markRecipes(tx, userId, wanted)

		return back
	})
}

// Marks lines with the recipes they're for, only those still there that the
// cook can see: one deleted since, or another's private recipe, is left off.
async function markRecipes(
	tx: Parameters<Parameters<Database['transaction']>[0]>[0],
	userId: string,
	marks: { itemId: string; recipeId: string }[],
) {
	if (!marks.length) return

	const seen = await tx
		.select({ id: recipes.id })
		.from(recipes)
		.where(
			and(
				inArray(recipes.id, [...new Set(marks.map((mark) => mark.recipeId))]),
				visibleTo(userId, tx),
			),
		)

	const kept = new Set(seen.map((recipe) => recipe.id))
	const allowed = marks.filter((mark) => kept.has(mark.recipeId))

	if (allowed.length)
		await tx.insert(groceryItemRecipes).values(allowed).onConflictDoNothing()
}
