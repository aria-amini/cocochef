import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { union } from 'drizzle-orm/pg-core'

import { type Database, getDb, type Queryable } from '@/db/connection'
import { groceryItems, pantryItems } from '@/db/schema'
import { pantryNameOf } from '@/lib/groceries/list'

import { findInPantry, foodOf, levelForCount, shelfLife } from './foods'
import {
	pantryBrand,
	pantryCount,
	pantryQuantityMax,
	type PantryCategory,
	type PantryItemInput,
	type PantryLevel,
} from './model'
import { insertPantryItem, insertPantryItems } from './schema'

export async function listPantryForUser(
	userId: string,
	database: Queryable = getDb(),
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
	database: Queryable = getDb(),
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
// the same thing. Back to plenty from low or out is a restock, so its date
// starts over.
export async function setPantryItemLevelForUser(
	userId: string,
	id: string,
	level: PantryLevel,
	database: Database = getDb(),
) {
	const [current] = await database
		.select({ level: pantryItems.level, quantity: pantryItems.quantity })
		.from(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))

	if (!current) return null

	const now = new Date()

	// A count kept stays: out is none left, and the cook's low or enough
	// stands beside the count they gave. One that had run out to none is
	// no longer known once there is some again.
	const quantity =
		current.quantity === null
			? null
			: level === 'out'
				? 0
				: current.quantity === 0
					? null
					: current.quantity

	const change: Partial<typeof pantryItems.$inferInsert> = {
		level,
		quantity,
		confirmedAt: now,
	}

	if (level === 'plenty' && current.level !== 'plenty') change.boughtAt = now

	const [item] = await database
		.update(pantryItems)
		.set(change)
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

// One item bought again: dated today, and plenty of it. Food kept by count
// takes what was bought onto what is left ("a dozen more eggs"); bought
// without saying how many, its count is no longer known.
export async function restockPantryItemForUser(
	userId: string,
	id: string,
	added?: number,
	database: Database = getDb(),
) {
	const [current] = await database
		.select({ name: pantryItems.name, quantity: pantryItems.quantity })
		.from(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))

	if (!current) return null

	const now = new Date()

	const quantity =
		added === undefined
			? null
			: pantryCount.parse(
					Math.min(pantryQuantityMax, (current.quantity ?? 0) + added),
				)

	const [item] = await database
		.update(pantryItems)
		.set({
			level:
				quantity === null
					? 'plenty'
					: levelForCount(quantity, foodOf(current.name)),
			quantity,
			confirmedAt: now,
			boughtAt: now,
		})
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

// Every brand the cook has written down, in the pantry or on the list, with
// the food it was for, to offer again for that food.
export async function listBrandsForUser(
	userId: string,
	database: Queryable = getDb(),
) {
	const rows = await union(
		database
			.select({ text: pantryItems.name, brand: pantryItems.brand })
			.from(pantryItems)
			.where(and(eq(pantryItems.userId, userId), isNotNull(pantryItems.brand))),
		database
			.select({ text: groceryItems.text, brand: groceryItems.brand })
			.from(groceryItems)
			.where(
				and(eq(groceryItems.userId, userId), isNotNull(groceryItems.brand)),
			),
	)

	return rows.flatMap(({ text, brand }) => (brand ? [{ text, brand }] : []))
}

// The brand the cook buys, or none when left blank.
export async function setPantryItemBrandForUser(
	userId: string,
	id: string,
	brand: string | null,
	database: Database = getDb(),
) {
	const [item] = await database
		.update(pantryItems)
		.set({ brand: pantryBrand.nullable().parse(brand) })
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

// Food past its days that the cook says is still there: kept, but as food
// to use soon, two days from its end, not as if just bought.
export async function keepPantryItemForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	const [current] = await database
		.select({ name: pantryItems.name, category: pantryItems.category })
		.from(pantryItems)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))

	if (!current) return null

	const now = Date.now()
	const keeps = shelfLife(current.name, current.category)

	const [item] = await database
		.update(pantryItems)
		.set({
			confirmedAt: new Date(now),
			boughtAt: new Date(now - Math.max(0, keeps - 2) * 86_400_000),
		})
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

// Into the freezer, or out of it. Frozen, it keeps a frozen food's months
// from today; taken out, it is fresh from today, its fridge days counted
// again.
export async function setPantryItemFrozenForUser(
	userId: string,
	id: string,
	frozen: boolean,
	database: Database = getDb(),
) {
	const now = new Date()

	const [item] = await database
		.update(pantryItems)
		.set(
			frozen
				? { frozenAt: now, confirmedAt: now }
				: { frozenAt: null, boughtAt: now, confirmedAt: now },
		)
		.where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)))
		.returning()

	return item ?? null
}

// A removed item put back as it was, under its own id, with its dates and
// count: undoing a delete loses nothing.
export async function restorePantryItemForUser(
	userId: string,
	item: PantryItemInput & {
		id: string
		createdAt: Date
		confirmedAt: Date
		boughtAt: Date
		frozenAt?: Date | null | undefined
	},
	database: Database = getDb(),
) {
	const data = insertPantryItem.parse(item)

	const [restored] = await database
		.insert(pantryItems)
		.values({
			...data,
			id: item.id,
			userId,
			spriteKey: data.spriteKey ?? null,
			createdAt: item.createdAt,
			confirmedAt: item.confirmedAt,
			boughtAt: item.boughtAt,
			frozenAt: item.frozenAt ?? null,
		})
		.onConflictDoNothing()
		.returning()

	return restored ?? null
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
// food make one item. A line that names a brand gives it to the item; one
// that names none leaves the item's own.
export async function restockPantryForUser(
	userId: string,
	bought: { text: string; category: PantryCategory; brand?: string | null }[],
	database: Queryable = getDb(),
) {
	const pantry = await listPantryForUser(userId, database)
	const restocked = new Set<string>()
	const branded = new Map<string, string>()
	const fresh: PantryItemInput[] = []

	for (const { text: line, category, brand } of bought) {
		const kept = findInPantry(line, pantry)

		if (kept) {
			restocked.add(kept.id)

			if (brand && brand !== kept.brand) branded.set(kept.id, brand)
			continue
		}

		const twin = findInPantry(line, fresh)

		if (twin) {
			if (brand) twin.brand = brand
			continue
		}

		fresh.push({
			// A grocery line may run longer than a pantry name can.
			name: pantryNameOf(line).slice(0, 80).trim(),
			category: foodOf(line)?.category ?? category,
			brand: brand ?? null,
		})
	}

	for (const [id, brand] of branded)
		await database
			.update(pantryItems)
			.set({ brand })
			.where(and(eq(pantryItems.userId, userId), eq(pantryItems.id, id)))

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

	return {
		restocked: restocked.size,
		added: added.length,
		// Which items, so a put-away can be taken back.
		restockedIds: [...restocked],
		addedIds: added.map((item) => item.id),
	}
}
