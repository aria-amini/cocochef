import { createServerFn } from '@tanstack/react-start'

import { requireAccountId } from '@/lib/auth/session'

import { cookIdInput, cookInput } from './model'
import { deleteCookForUser, logCookForUser } from './repository'

export const logCook = createServerFn({ method: 'POST' })
	.validator(cookInput)
	.handler(async ({ data }) =>
		logCookForUser(await requireAccountId('log what you cook'), data.recipeId),
	)

export const undoCook = createServerFn({ method: 'POST' })
	.validator(cookIdInput)
	.handler(async ({ data }) =>
		deleteCookForUser(await requireAccountId('log what you cook'), data.id),
	)
