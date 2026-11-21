import { createServerFn } from '@tanstack/react-start'

import { getAccountId, requireAccountId } from '@/lib/auth/session'
import { resolveStoredImage } from '@/lib/s3'

import {
	dropPlanForUser,
	finishCookForUser,
	getPlanForUser,
	listInProgressForUser,
	planCookForUser,
	unfinishCookForUser,
} from './plans'
import {
	getCookingForUser,
	updateCookingForUser,
	listActiveCookingForUser,
} from './repository'
import {
	cookingCommand,
	cookingId,
	cookPlanInput,
	finishCookInput,
	unfinishCookInput,
} from './schema'

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

// The recipes in progress, for home. A visitor has none.
export const listInProgress = createServerFn({ method: 'GET' }).handler(
	async () => {
		const accountId = await getAccountId()

		if (!accountId) return []

		// Uploaded photos are stored as keys, and need a fetchable address;
		// one that can't be signed is left off.
		return Promise.all(
			(await listInProgressForUser(accountId)).map(async (plan) => ({
				...plan,
				imageUrl: plan.imageUrl
					? await resolveStoredImage(plan.imageUrl).catch(() => null)
					: null,
			})),
		)
	},
)

// A recipe in progress, or null; always null for a visitor.
export const getPlan = createServerFn({ method: 'GET' })
	.validator(cookingId)
	.handler(async ({ data }) => {
		const accountId = await getAccountId()

		return accountId ? getPlanForUser(accountId, data.recipeId) : null
	})

export const planCook = createServerFn({ method: 'POST' })
	.validator(cookPlanInput)
	.handler(async ({ data }) =>
		planCookForUser(await requireAccountId('plan a meal'), data),
	)

export const dropPlan = createServerFn({ method: 'POST' })
	.validator(cookingId)
	.handler(async ({ data }) =>
		dropPlanForUser(await requireAccountId('plan a meal'), data.recipeId),
	)

export const finishCook = createServerFn({ method: 'POST' })
	.validator(finishCookInput)
	.handler(async ({ data }) =>
		finishCookForUser(await requireAccountId('plan a meal'), data),
	)

export const unfinishCook = createServerFn({ method: 'POST' })
	.validator(unfinishCookInput)
	.handler(async ({ data }) =>
		unfinishCookForUser(await requireAccountId('plan a meal'), data),
	)
