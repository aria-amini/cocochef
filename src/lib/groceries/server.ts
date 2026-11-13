import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getAccountId, requireAccountId } from '@/lib/auth/session'

import { groceryFields, groceryInputs } from './model'
import {
	addGroceriesForUser,
	clearCheckedGroceriesForUser,
	countWaitingGroceriesForUser,
	deleteGroceryForUser,
	listGroceriesForUser,
	renameGroceryForUser,
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

export const clearCheckedGroceries = createServerFn({ method: 'POST' }).handler(
	async () =>
		clearCheckedGroceriesForUser(await requireAccountId('keep a grocery list')),
)
