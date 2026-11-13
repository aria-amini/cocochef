import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getAccountId, requireAccountId } from '@/lib/auth/session'
import {
	addGroceriesForUser,
	listGroceriesForUser,
} from '@/lib/groceries/repository'

import { findInPantry, shelfState } from './foods'
import {
	pantryCategories,
	pantryCount,
	pantryItemInput,
	pantryLevels,
	type PantryLevel,
} from './model'
import {
	createPantryItemsForUser,
	deletePantryItemForUser,
	keepPantryItemForUser,
	listPantryForUser,
	markHaveForUser,
	restockPantryForUser,
	restockPantryItemForUser,
	restorePantryItemForUser,
	setPantryItemFrozenForUser,
	setPantryItemCountForUser,
	setPantryItemLevelForUser,
} from './repository'
import { insertPantryItems } from './schema'

// Each item with how it keeps: fresh, worth a check, or past its days.
async function pantryWithShelf(userId: string) {
	const now = new Date()

	return (await listPantryForUser(userId)).map((item) => {
		const { state, spoils, daysLeft, boughtDaysAgo } = shelfState(item, now)

		return {
			...item,
			stale: state === 'stale',
			expired: state === 'expired',
			spoils,
			daysLeft,
			boughtDaysAgo,
		}
	})
}

// What the pantry can vouch for: food bought for a meal is taken as eaten
// once its few days are up, so recipes and the grocery list never count on
// it. The ingredients page still shows it, to be checked.
async function knownPantry(userId: string) {
	return (await pantryWithShelf(userId)).filter((item) => !item.expired)
}

// The whole pantry, or null for a visitor, who has none to keep until they
// sign up.
export const listPantry = createServerFn({ method: 'GET' }).handler(
	async () => {
		const accountId = await getAccountId()

		return accountId ? pantryWithShelf(accountId) : null
	},
)

// What a recipe's reader has on hand. A visitor has nothing.
export const pantryOnHand = createServerFn({ method: 'GET' }).handler(
	async () => {
		const accountId = await getAccountId()

		return accountId ? knownPantry(accountId) : []
	},
)

export const createPantryItems = createServerFn({ method: 'POST' })
	.validator(insertPantryItems)
	.handler(async ({ data }) =>
		createPantryItemsForUser(await requireAccountId('keep ingredients'), data),
	)

// Food that runs low or out goes on the list in the same tap, unless a line
// for it is already waiting there. Says whether it went on.
async function listIfWanting(
	userId: string,
	item: { name: string; level: PantryLevel } | null,
) {
	if (!item || item.level === 'plenty') return false

	const waiting = (await listGroceriesForUser(userId)).filter(
		(line) => !line.checkedAt,
	)

	if (waiting.some((line) => findInPantry(line.text, [item]))) return false

	return (await addGroceriesForUser(userId, [{ text: item.name }])).length > 0
}

export const setPantryItemLevel = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			id: z.string().min(1),
			level: z.enum(pantryLevels),
			// False when an undo puts a level back: that is no ask to buy it.
			list: z.boolean().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const accountId = await requireAccountId('keep ingredients')

		const item = await setPantryItemLevelForUser(accountId, data.id, data.level)

		return {
			item,
			listed:
				data.list === false ? false : await listIfWanting(accountId, item),
		}
	})

export const setPantryItemCount = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), count: pantryCount }))
	.handler(async ({ data }) => {
		const accountId = await requireAccountId('keep ingredients')

		const item = await setPantryItemCountForUser(accountId, data.id, data.count)

		return { item, listed: await listIfWanting(accountId, item) }
	})

// Bought more: back to plenty, dated today, with how many if counted.
export const restockPantryItem = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), added: pantryCount.optional() }))
	.handler(async ({ data }) =>
		restockPantryItemForUser(
			await requireAccountId('keep ingredients'),
			data.id,
			data.added,
		),
	)

// Past its days, but the cook says it is still there.
export const keepPantryItem = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) =>
		keepPantryItemForUser(await requireAccountId('keep ingredients'), data.id),
	)

// Put in the freezer, or taken out of it.
export const setPantryItemFrozen = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), frozen: z.boolean() }))
	.handler(async ({ data }) =>
		setPantryItemFrozenForUser(
			await requireAccountId('keep ingredients'),
			data.id,
			data.frozen,
		),
	)

export const restorePantryItem = createServerFn({ method: 'POST' })
	.validator(
		pantryItemInput.extend({
			id: z.string().min(1),
			createdAt: z.coerce.date(),
			confirmedAt: z.coerce.date(),
			boughtAt: z.coerce.date(),
			frozenAt: z.coerce.date().nullable().optional(),
		}),
	)
	.handler(async ({ data }) =>
		restorePantryItemForUser(await requireAccountId('keep ingredients'), data),
	)

export const deletePantryItem = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) =>
		deletePantryItemForUser(
			await requireAccountId('keep ingredients'),
			data.id,
		),
	)

export const markHave = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			text: z.string().trim().min(1).max(500),
			category: z.enum(pantryCategories),
		}),
	)
	.handler(async ({ data }) =>
		markHaveForUser(await requireAccountId('keep ingredients'), data),
	)

export const restockPantry = createServerFn({ method: 'POST' })
	.validator(
		z
			.array(
				z.object({
					text: z.string().trim().min(1).max(200),
					category: z.enum(pantryCategories),
				}),
			)
			.min(1)
			.max(100),
	)
	.handler(async ({ data }) =>
		restockPantryForUser(await requireAccountId('keep ingredients'), data),
	)
