import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getAccountId, requireAccountId } from '@/lib/auth/session'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'

import { shelfState } from './foods'
import { pantryCount, pantryItemInput, pantryLevels } from './model'
import {
	createPantryItemsForUser,
	deletePantryItemForUser,
	keepPantryItemForUser,
	listPantryForUser,
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

// A level or count says what's home; it never puts food on the list. Low
// or out food is offered there, and the cook says yes.
export const setPantryItemLevel = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			id: z.string().min(1),
			level: z.enum(pantryLevels),
		}),
	)
	.handler(async ({ data }) => {
		const accountId = await requireAccountId('keep ingredients')

		return setPantryItemLevelForUser(accountId, data.id, data.level)
	})

export const setPantryItemCount = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), count: pantryCount }))
	.handler(async ({ data }) => {
		const accountId = await requireAccountId('keep ingredients')

		return setPantryItemCountForUser(accountId, data.id, data.count)
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

// The cook says a food is home: the pantry item for it is topped up, or one
// is made, as putting shopping away does. "2 lb short ribs" is short ribs.
export const haveFood = createServerFn({ method: 'POST' })
	.validator(z.object({ text: z.string().trim().min(1).max(200) }))
	.handler(async ({ data }) =>
		restockPantryForUser(await requireAccountId('keep ingredients'), [
			{ text: data.text, category: ingredientCategory(data.text) },
		]),
	)
