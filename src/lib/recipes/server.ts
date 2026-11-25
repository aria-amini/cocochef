import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { readSession, getViewerId, requireAccountId } from '@/lib/auth/session'
import { dropPlanForUser } from '@/lib/cooking/plans'
import {
	leaveRecipeForUser,
	recipeLinesForUser,
} from '@/lib/groceries/repository'
import { recipeReadiness } from '@/lib/pantry/stock.server'
import { resolveStoredImage } from '@/lib/s3'
import {
	getWebRecipeLink,
	reservePrivateRecipeAddress,
} from '@/lib/sharing/repository'

import {
	recipeIdInput,
	recipeInput,
	recipeRemovalInput,
	recipeUpdateInput,
} from './model'
import {
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
	const viewer = await getViewerId()
	const shelf = await listShelfForUser(viewer)

	return {
		...shelf,
		// A visitor keeps nothing, so the shelf asks them to sign up instead.
		signedIn: viewer !== 'visitor',
		// Who is asking, so the page tells their own recipes from saved ones
		// on its first draw, before the browser has read the session.
		viewerId: viewer === 'visitor' ? null : viewer,
		recipes: await Promise.all(shelf.recipes.map(withSignedImage)),
	}
})

// How ready each recipe on the shelf is to cook. Read apart from the shelf,
// so the page never waits on the kitchen to draw.
export const listShelfReadiness = createServerFn({ method: 'GET' }).handler(
	async () => {
		const viewer = await getViewerId()

		if (viewer === 'visitor') return {}

		const shelf = await listShelfForUser(viewer)

		return Object.fromEntries(
			await recipeReadiness(shelf.recipes.map((recipe) => recipe.id)),
		)
	},
)

// A recipe as the viewer sees it, with the readable address to show it at.
export const readRecipe = createServerOnlyFn(async (id: string) => {
	const viewerId = await getViewerId()
	const recipe = await getRecipeForUser(viewerId, id)

	if (!recipe) return recipe

	// Reserving an address writes a profile, which only an account has.
	const session = await readSession()

	if (!recipe.publicPath && recipe.owned && session)
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

export const getRecipe = createServerFn({ method: 'GET' })
	.validator(recipeIdInput)
	.handler(({ data }) => readRecipe(data.id))

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

// A recipe let go of is off what's in progress too, and its foods waiting
// on the list go with it when the cook says so. Its lines are found while
// the recipe still names them, and only taken off once it's gone.
async function letGo<Removed>(
	userId: string,
	data: { id: string; groceries?: boolean | undefined },
	remove: () => Promise<Removed>,
) {
	const lines = data.groceries
		? await recipeLinesForUser(userId, data.id)
		: undefined

	const removed = await remove()

	if (!removed) return removed

	if (lines) await leaveRecipeForUser(userId, data.id, lines)
	await dropPlanForUser(userId, data.id)

	return removed
}

export const removeSavedRecipe = createServerFn({ method: 'POST' })
	.validator(recipeRemovalInput)
	.handler(async ({ data }) => {
		const userId = await requireAccountId('save recipes')

		return letGo(userId, data, () => removeSavedRecipeForUser(userId, data.id))
	})

export const updateRecipe = createServerFn({ method: 'POST' })
	.validator(recipeUpdateInput)
	.handler(async ({ data }) =>
		updateRecipeForUser(await requireAccountId('save recipes'), data),
	)

export const deleteRecipe = createServerFn({ method: 'POST' })
	.validator(recipeRemovalInput)
	.handler(async ({ data }) => {
		const userId = await requireAccountId('save recipes')

		return letGo(userId, data, () => deleteRecipeForUser(userId, data.id))
	})

// Clearing several off the shelf at once: each one the cook wrote is deleted,
// each one they saved comes off their shelf, the same as one at a time.
export const deleteRecipes = createServerFn({ method: 'POST' })
	.validator(z.object({ ids: z.array(recipeIdInput.shape.id).min(1).max(500) }))
	.handler(async ({ data }) => {
		const userId = await requireAccountId('save recipes')
		let removed = 0

		for (const id of new Set(data.ids))
			if (await letGo(userId, { id }, () => deleteRecipeForUser(userId, id)))
				removed++

		return { removed }
	})
