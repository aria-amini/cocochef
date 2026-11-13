import { createServerFn } from '@tanstack/react-start'

import { requireAccountId } from '@/lib/auth/session'

import {
	getCookingForUser,
	updateCookingForUser,
	listActiveCookingForUser,
} from './repository'
import { cookingCommand, cookingId } from './schema'

export const getCooking = createServerFn({ method: 'GET' })
	.validator(cookingId)
	.handler(async ({ data }) =>
		getCookingForUser(await requireAccountId('keep your place'), data.recipeId),
	)

export const updateCooking = createServerFn({ method: 'POST' })
	.validator(cookingCommand)
	.handler(async ({ data }) =>
		updateCookingForUser(await requireAccountId('keep your place'), data),
	)

export const listActiveCooking = createServerFn({ method: 'GET' }).handler(
	async () =>
		listActiveCookingForUser(await requireAccountId('keep your place')),
)
