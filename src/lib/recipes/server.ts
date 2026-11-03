import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getAiModel } from '@/lib/ai/model'
import {
	getCurrentSession,
	getViewerId,
	requireAccountId,
} from '@/lib/auth/session'
import { createRateLimiter, createSlots } from '@/lib/rate-limit'
import { resolveStoredImage } from '@/lib/s3'
import {
	getWebRecipeLink,
	reservePrivateRecipeAddress,
} from '@/lib/sharing/repository'

import { recipeIdInput, recipeInput, recipeUpdateInput } from './model'
import {
	aiSourceFingerprint,
	copyRecipeForUser,
	createAiVersionForUser,
	findAiVersionForUser,
	createRecipeForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listShelfForUser,
	removeSavedRecipeForUser,
	saveRecipeForUser,
	updateRecipeForUser,
} from './repository'
import { tidyRecipe } from './tidy'
import { tidyRecipeInput } from './tidy-input'
import { parseTransferDocument } from './transfer'
import {
	exportRecipesForUser,
	importRecipesForUser,
} from './transfer-repository'

// Uploaded photos are stored as bucket keys; clients need a fetchable URL.
async function withSignedImage<T extends { imageUrl: string | null }>(
	recipe: T,
): Promise<T> {
	if (!recipe.imageUrl) return recipe

	try {
		return { ...recipe, imageUrl: await resolveStoredImage(recipe.imageUrl) }
	} catch {
		return { ...recipe, imageUrl: null }
	}
}

export const listShelf = createServerFn({ method: 'GET' }).handler(async () => {
	const shelf = await listShelfForUser(await getViewerId())

	return {
		...shelf,
		recipes: await Promise.all(shelf.recipes.map(withSignedImage)),
	}
})

export const getRecipe = createServerFn({ method: 'GET' })
	.validator(recipeIdInput)
	.handler(async ({ data }) => {
		const viewerId = await getViewerId()
		const recipe = await getRecipeForUser(viewerId, data.id)

		if (!recipe) return recipe

		// Reserving an address writes a profile, which only an account has; a guest
		// who still owns an older recipe can open it without one.
		const session = await getCurrentSession()

		if (
			!recipe.publicPath &&
			recipe.owned &&
			session &&
			!session.user.isAnonymous
		)
			recipe.publicPath = await reservePrivateRecipeAddress(viewerId, recipe)

		if (
			!recipe.publicPath &&
			!recipe.userId &&
			recipe.sourceUrl &&
			recipe.finalizedAt
		) {
			const link = await getWebRecipeLink(viewerId, recipe.id)

			if (link) recipe.publicPath = `/sites/${link.site}/${link.slug}`
		}

		return withSignedImage(recipe)
	})

export const copyRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		copyRecipeForUser(await requireAccountId('copy recipes'), data.id),
	)

export const createRecipe = createServerFn({ method: 'POST' })
	.validator(recipeInput)
	.handler(async ({ data }) =>
		createRecipeForUser(await requireAccountId('save recipes'), data),
	)

export const exportRecipes = createServerFn({ method: 'GET' })
	.validator(z.object({ id: z.string().min(1).optional() }))
	.handler(async ({ data }) =>
		exportRecipesForUser(await getViewerId(), data.id),
	)

export const importRecipes = createServerFn({ method: 'POST' })
	.validator(z.object({ text: z.string().max(10_000_000) }))
	.handler(async ({ data }) => {
		const parsed = parseTransferDocument(data.text)

		if (!parsed.ok) throw new Error(parsed.error)

		return importRecipesForUser(
			await requireAccountId('import recipes'),
			parsed.recipes,
		)
	})

export const saveRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		saveRecipeForUser(await requireAccountId('save recipes'), data.id),
	)

export const removeSavedRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		removeSavedRecipeForUser(await requireAccountId('save recipes'), data.id),
	)

export const updateRecipe = createServerFn({ method: 'POST' })
	.validator(recipeUpdateInput)
	.handler(async ({ data }) =>
		updateRecipeForUser(await requireAccountId('save recipes'), data),
	)

export const deleteRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		deleteRecipeForUser(await requireAccountId('save recipes'), data.id),
	)

const tidyMessage = 'too many AI requests — wait a minute and try again'

const tidyUserLimit = createRateLimiter({ limit: 10, message: tidyMessage })

const tidyIpLimit = createRateLimiter({ limit: 20, message: tidyMessage })

// Every request costs money, so the whole app has a ceiling too.
const tidyGlobalLimit = createRateLimiter({
	limit: 300,
	windowMs: 60 * 60_000,
	message: 'AI is busy right now — try again later',
})

const withTidySlot = createSlots({
	max: 6,
	maxPerKey: 1,
	message: 'still tidying your last recipe — one moment',
})

export const getAiVersion = createServerFn({ method: 'GET' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		findAiVersionForUser(await requireAccountId('load AI versions'), data.id),
	)

// Generate from server-loaded content, and save a new private copy. The source
// is checked again before writing so concurrent edits are never overwritten.
export const createAiVersion = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) => {
		const userId = await requireAccountId('clean up recipes with AI')
		const existing = await findAiVersionForUser(userId, data.id)

		if (existing) return existing
		const recipe = await getRecipeForUser(userId, data.id)

		if (!recipe) throw new Error('recipe not found')
		const model = getAiModel()

		if (!model) throw new Error("AI isn't set up here yet")
		tidyUserLimit(userId)
		tidyIpLimit(getRequestIP() ?? 'unknown')
		tidyGlobalLimit('app')

		const cleaned = await withTidySlot(userId, () =>
			tidyRecipe(model, {
				title: recipe.title,
				ingredients: recipe.ingredients,
				steps: recipe.steps,
				notes: recipe.notes,
				sourceNotes: recipe.sourceNotes ?? undefined,
			}),
		)

		return createAiVersionForUser(
			userId,
			recipe.id,
			aiSourceFingerprint(recipe),
			{
				...cleaned,
				notes: cleaned.notes ?? null,
			},
		)
	})

// A proposal only: nothing is saved, so the editor can show it and undo it.
export const tidyRecipeWithAi = createServerFn({ method: 'POST' })
	.validator(tidyRecipeInput)
	.handler(async ({ data }) => {
		const userId = await requireAccountId('tidy recipes with AI')
		const model = getAiModel()

		if (!model) throw new Error("AI isn't set up here yet")

		tidyUserLimit(userId)
		tidyIpLimit(getRequestIP() ?? 'unknown')
		tidyGlobalLimit('app')

		return withTidySlot(userId, () => tidyRecipe(model, data))
	})
