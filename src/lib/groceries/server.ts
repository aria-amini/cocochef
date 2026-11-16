import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getAccountId, requireAccountId } from '@/lib/auth/session'
import { pantryLevels } from '@/lib/pantry/model'

import { groceryFields, groceryInputs } from './model'
import {
	addGroceriesForUser,
	clearCheckedGroceriesForUser,
	countWaitingGroceriesForUser,
	deleteGroceryForUser,
	leaveGroceryForUser,
	listGroceriesForUser,
	renameGroceryForUser,
	restoreCartForUser,
	setGroceryCheckedForUser,
} from './repository'

const itemId = z.object({ id: z.string().min(1) })

// The list, or null for a visitor, who has none to keep until they sign up.
export const listGroceries = createServerFn({ method: 'GET' }).handler(
	async () => {
		const accountId = await getAccountId()

		return accountId ? listGroceriesForUser(accountId) : null
	},
)

// What the nav's badge shows on every page. A visitor has nothing to buy.
export const countWaitingGroceries = createServerFn({ method: 'GET' }).handler(
	async () => {
		const accountId = await getAccountId()

		return accountId ? countWaitingGroceriesForUser(accountId) : 0
	},
)

export const addGroceries = createServerFn({ method: 'POST' })
	.validator(groceryInputs)
	.handler(async ({ data }) =>
		addGroceriesForUser(await requireAccountId('keep a grocery list'), data),
	)

export const setGroceryChecked = createServerFn({ method: 'POST' })
	.validator(itemId.extend({ checked: z.boolean() }))
	.handler(async ({ data }) =>
		setGroceryCheckedForUser(
			await requireAccountId('keep a grocery list'),
			data.id,
			data.checked,
		),
	)

export const renameGrocery = createServerFn({ method: 'POST' })
	.validator(itemId.extend({ text: groceryFields.text }))
	.handler(async ({ data }) =>
		renameGroceryForUser(
			await requireAccountId('keep a grocery list'),
			data.id,
			data.text,
		),
	)

export const deleteGrocery = createServerFn({ method: 'POST' })
	.validator(itemId)
	.handler(async ({ data }) =>
		deleteGroceryForUser(
			await requireAccountId('keep a grocery list'),
			data.id,
		),
	)

// One recipe's share taken off a line others still want.
export const leaveGrocery = createServerFn({ method: 'POST' })
	.validator(
		itemId.extend({ recipeId: z.string().min(1), text: groceryFields.text }),
	)
	.handler(async ({ data }) =>
		leaveGroceryForUser(
			await requireAccountId('keep a grocery list'),
			data.id,
			data.recipeId,
			data.text,
		),
	)

// Clears the cart, putting every ticked line away in the pantry.
export const clearCheckedGroceries = createServerFn({
	method: 'POST',
}).handler(async () =>
	clearCheckedGroceriesForUser(await requireAccountId('keep a grocery list')),
)

const putAway = z.object({
	lines: z
		.array(
			z.object({
				id: z.string().min(1),
				text: groceryFields.text,
				recipes: z.array(z.string().min(1)).max(20),
				checkedAt: z.iso.datetime(),
				createdAt: z.iso.datetime(),
			}),
		)
		.max(500),
	topped: z
		.array(
			z.object({
				id: z.string().min(1),
				was: z.object({
					level: z.enum(pantryLevels),
					quantity: z.number().int().nullable(),
					confirmedAt: z.iso.datetime(),
					boughtAt: z.iso.datetime(),
				}),
			}),
		)
		.max(500),
	made: z.array(z.string().min(1)).max(500),
})

// Takes a put-away back: the cart as it was, and the pantry as it stood.
export const restoreCart = createServerFn({ method: 'POST' })
	.validator(putAway)
	.handler(async ({ data }) =>
		restoreCartForUser(await requireAccountId('keep a grocery list'), data),
	)
