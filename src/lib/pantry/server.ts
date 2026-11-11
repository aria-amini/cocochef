import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getCurrentSession, requireUserId } from '@/lib/auth/session'

import { shelfState } from './foods'
import { pantryCategories, pantryCount, pantryLevels } from './model'
import {
	createPantryItemsForUser,
	deletePantryItemForUser,
	listPantryForUser,
	markHaveForUser,
	restockPantryForUser,
	setPantryItemCountForUser,
	setPantryItemLevelForUser,
} from './repository'
import { insertPantryItems } from './schema'

// What the pantry still knows: food bought for a meal leaves once its few
// days are up. Staples stay, marked stale once they want checking.
async function knownPantry(userId: string) {
	const now = new Date()

	return (await listPantryForUser(userId)).flatMap((item) => {
		const { state, spoils, daysLeft, boughtDaysAgo } = shelfState(item, now)

		return state === 'expired'
			? []
			: [
					{
						...item,
						stale: state === 'stale',
						spoils,
						daysLeft,
						boughtDaysAgo,
					},
				]
	})
}

export const listPantry = createServerFn({ method: 'GET' }).handler(async () =>
	knownPantry(await requireUserId()),
)

// What a recipe's reader has on hand. A visitor has nothing, and asking must
// not start a session for them.
export const pantryOnHand = createServerFn({ method: 'GET' }).handler(
	async () => {
		const session = await getCurrentSession()

		return session ? knownPantry(session.user.id) : []
	},
)

export const createPantryItems = createServerFn({ method: 'POST' })
	.validator(insertPantryItems)
	.handler(async ({ data }) =>
		createPantryItemsForUser(await requireUserId(), data),
	)

export const setPantryItemLevel = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), level: z.enum(pantryLevels) }))
	.handler(async ({ data }) =>
		setPantryItemLevelForUser(await requireUserId(), data.id, data.level),
	)

export const setPantryItemCount = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1), count: pantryCount }))
	.handler(async ({ data }) =>
		setPantryItemCountForUser(await requireUserId(), data.id, data.count),
	)

export const deletePantryItem = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) =>
		deletePantryItemForUser(await requireUserId(), data.id),
	)

export const markHave = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			text: z.string().trim().min(1).max(500),
			category: z.enum(pantryCategories),
		}),
	)
	.handler(async ({ data }) => markHaveForUser(await requireUserId(), data))

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
		restockPantryForUser(await requireUserId(), data),
	)
