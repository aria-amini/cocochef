import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from '@/lib/auth/session'

import { groceryFields, groceryInputs } from './model'
import {
	addGroceriesForUser,
	clearCheckedGroceriesForUser,
	deleteGroceryForUser,
	listGroceriesForUser,
	renameGroceryForUser,
	setGroceryCheckedForUser,
} from './repository'

const itemId = z.object({ id: z.string().min(1) })

export const listGroceries = createServerFn({ method: 'GET' }).handler(
	async () => listGroceriesForUser(await requireUserId()),
)

export const addGroceries = createServerFn({ method: 'POST' })
	.validator(groceryInputs)
	.handler(async ({ data }) => addGroceriesForUser(await requireUserId(), data))

export const setGroceryChecked = createServerFn({ method: 'POST' })
	.validator(itemId.extend({ checked: z.boolean() }))
	.handler(async ({ data }) =>
		setGroceryCheckedForUser(await requireUserId(), data.id, data.checked),
	)

export const renameGrocery = createServerFn({ method: 'POST' })
	.validator(itemId.extend({ text: groceryFields.text }))
	.handler(async ({ data }) =>
		renameGroceryForUser(await requireUserId(), data.id, data.text),
	)

export const deleteGrocery = createServerFn({ method: 'POST' })
	.validator(itemId)
	.handler(async ({ data }) =>
		deleteGroceryForUser(await requireUserId(), data.id),
	)

export const clearCheckedGroceries = createServerFn({ method: 'POST' }).handler(
	async () => clearCheckedGroceriesForUser(await requireUserId()),
)
