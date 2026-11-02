import { createServerFn } from '@tanstack/react-start'

import { requireUserId } from '@/lib/auth/session'

import {
	getCookingForUser,
	updateCookingForUser,
	listActiveCookingForUser,
} from './repository'
import { cookingCommand, cookingId } from './schema'

export const getCooking = createServerFn({ method: 'GET' })
	.validator(cookingId)
	.handler(async ({ data }) =>
		getCookingForUser(await requireUserId(), data.recipeId),
	)

export const updateCooking = createServerFn({ method: 'POST' })
	.validator(cookingCommand)
	.handler(async ({ data }) =>
		updateCookingForUser(await requireUserId(), data),
	)

export const listActiveCooking = createServerFn({ method: 'GET' }).handler(
	async () => listActiveCookingForUser(await requireUserId()),
)
