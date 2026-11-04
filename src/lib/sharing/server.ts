import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getCurrentSession } from '@/lib/auth/session'
import { recipeIdInput } from '@/lib/recipes/model'
import { resolveStoredImage } from '@/lib/s3'

import {
	getOwnedRecipeAtAddress,
	getPublishedRecipe,
	getPublicProfile,
	getRecipeShare,
	getSharingProfile,
	getWebRecipe,
	getWebRecipeLink,
	saveSharingProfile,
	setRecipeShare,
} from './repository'
import {
	publicRecipeInput,
	recipeShareInput,
	sharingProfileInput,
	unlistedRecipeInput,
	webRecipeInput,
} from './schema'

async function accountId() {
	const session = await getCurrentSession()

	if (!session || session.user.isAnonymous)
		throw new Error('sign in to share recipes')

	return session.user.id
}

// Visibility is checked on every read, including after unpublishing.
function preventCaching() {
	setResponseHeader('Cache-Control', 'private, no-store')
	setResponseHeader('Referrer-Policy', 'no-referrer')
}

async function withPublicImage<T extends { imageUrl: string | null }>(
	recipe: T,
) {
	if (!recipe.imageUrl) return recipe

	try {
		return { ...recipe, imageUrl: await resolveStoredImage(recipe.imageUrl) }
	} catch {
		return { ...recipe, imageUrl: null }
	}
}

export const getMySharingProfile = createServerFn({ method: 'GET' }).handler(
	async () => {
		const session = await getCurrentSession()

		return session && !session.user.isAnonymous
			? getSharingProfile(session.user.id)
			: null
	},
)

export const updateSharingProfile = createServerFn({ method: 'POST' })
	.validator(sharingProfileInput)
	.handler(async ({ data }) => {
		try {
			return await saveSharingProfile(await accountId(), data)
		} catch (error) {
			if (
				z
					.object({ cause: z.object({ code: z.literal('23505') }) })
					.safeParse(error).success
			)
				throw new Error('that handle is taken — choose another')
			throw error
		}
	})

export const getMyRecipeShare = createServerFn({ method: 'GET' })
	.validator(recipeIdInput)
	.handler(async ({ data }) => {
		const session = await getCurrentSession()

		return session && !session.user.isAnonymous
			? getRecipeShare(session.user.id, data.id)
			: null
	})

export const updateRecipeShare = createServerFn({ method: 'POST' })
	.validator(recipeShareInput)
	.handler(async ({ data }) => setRecipeShare(await accountId(), data))

export const createWebSharingLink = createServerFn({ method: 'POST' })
	.validator(recipeIdInput)
	.handler(async ({ data }) => {
		const session = await getCurrentSession()

		if (!session) throw new Error('open the recipe on your shelf to share it')

		return getWebRecipeLink(session.user.id, data.id)
	})

export const readPublicProfile = createServerFn({ method: 'GET' })
	.validator(z.object({ handle: publicRecipeInput.shape.handle }))
	.handler(async ({ data }) => {
		preventCaching()
		const profile = await getPublicProfile(data.handle)

		return profile
			? {
					...profile,
					recipes: await Promise.all(profile.recipes.map(withPublicImage)),
				}
			: null
	})

export const readOwnedRecipeAddress = createServerFn({ method: 'GET' })
	.validator(publicRecipeInput)
	.handler(async ({ data }) => {
		preventCaching()
		const session = await getCurrentSession()

		if (!session || session.user.isAnonymous) return null

		return getOwnedRecipeAtAddress(session.user.id, data.handle, data.slug)
	})

export const readPublicRecipe = createServerFn({ method: 'GET' })
	.validator(publicRecipeInput)
	.handler(async ({ data }) => {
		preventCaching()
		const recipe = await getPublishedRecipe(data)

		return recipe ? withPublicImage(recipe) : null
	})

// Legacy unlisted links no longer grant access.
export const readUnlistedRecipe = createServerFn({ method: 'GET' })
	.validator(unlistedRecipeInput)
	.handler(() => {
		preventCaching()

		return null
	})

export const readWebRecipe = createServerFn({ method: 'GET' })
	.validator(webRecipeInput)
	.handler(async ({ data }) => {
		preventCaching()
		const recipe = await getWebRecipe(data.site, data.slug)

		return recipe ? withPublicImage(recipe) : null
	})
