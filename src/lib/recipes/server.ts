import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
	getCurrentSession,
	getViewerId,
	requireAccountId,
} from '@/lib/auth/session'
import { resolveStoredImage } from '@/lib/s3'
import {
	getWebRecipeLink,
	reservePrivateRecipeAddress,
} from '@/lib/sharing/repository'

import { recipeIdInput, recipeInput, recipeUpdateInput } from './model'
import {
	copyRecipeForUser,
	createRecipeForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listShelfForUser,
	removeSavedRecipeForUser,
	saveRecipeForUser,
	updateRecipeForUser,
} from './repository'
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
