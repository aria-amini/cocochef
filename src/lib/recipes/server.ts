import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from '@/lib/auth/session'
import { resolveStoredImage } from '@/lib/s3'

import {
	bookIdInput,
	bookInput,
	bookRenameInput,
	recipeIdInput,
	recipeInput,
	recipeMoveInput,
	recipeUpdateInput,
} from './model'
import {
	createCollectionForUser,
	createRecipeForUser,
	deleteCollectionForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listCollectionsForUser,
	listShelfForUser,
	moveRecipeForUser,
	renameCollectionForUser,
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

export const moveRecipe = createServerFn({ method: 'POST' })
	.validator(recipeMoveInput)
	.handler(async ({ data }) =>
		moveRecipeForUser(await requireUserId(), data.id, data.collectionId),
	)

export const listBooks = createServerFn({ method: 'GET' }).handler(async () =>
	listCollectionsForUser(await requireUserId()),
)

export const createBook = createServerFn({ method: 'POST' })
	.validator(bookInput)
	.handler(async ({ data }) =>
		createCollectionForUser(await requireUserId(), data.name),
	)

export const renameBook = createServerFn({ method: 'POST' })
	.validator(bookRenameInput)
	.handler(async ({ data }) =>
		renameCollectionForUser(await requireUserId(), data.id, data.name),
	)

export const deleteBook = createServerFn({ method: 'POST' })
	.validator(bookIdInput)
	.handler(async ({ data }) =>
		deleteCollectionForUser(await requireUserId(), data.id),
	)
