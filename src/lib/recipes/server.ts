import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from '@/lib/auth/session'
import { resolveStoredImage } from '@/lib/s3'

import { recipeIdInput, recipeInput, recipeUpdateInput } from './model'
import {
	createRecipeForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listShelfForUser,
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
	const shelf = await listShelfForUser(await requireUserId())

	return {
		...shelf,
		recipes: await Promise.all(shelf.recipes.map(withSignedImage)),
	}
})

export const getRecipe = createServerFn({ method: 'GET' })
	.validator(recipeIdInput)
	.handler(async ({ data }) => {
		const recipe = await getRecipeForUser(await requireUserId(), data.id)

		return recipe ? withSignedImage(recipe) : recipe
	})

export const createRecipe = createServerFn({ method: 'POST' })
	.validator(recipeInput)
	.handler(async ({ data }) => createRecipeForUser(await requireUserId(), data))

export const exportRecipes = createServerFn({ method: 'GET' })
	.validator(z.object({ id: z.string().min(1).optional() }))
	.handler(async ({ data }) =>
		exportRecipesForUser(await requireUserId(), data.id),
	)

export const importRecipes = createServerFn({ method: 'POST' })
	.validator(z.object({ text: z.string().max(10_000_000) }))
	.handler(async ({ data }) => {
		const parsed = parseTransferDocument(data.text)

		if (!parsed.ok) throw new Error(parsed.error)

		return importRecipesForUser(await requireUserId(), parsed.recipes)
	})

export const saveRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		saveRecipeForUser(await requireUserId(), data.id),
	)

export const updateRecipe = createServerFn({ method: 'POST' })
	.validator(recipeUpdateInput)
	.handler(async ({ data }) => updateRecipeForUser(await requireUserId(), data))

export const deleteRecipe = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) =>
		deleteRecipeForUser(await requireUserId(), data.id),
	)
