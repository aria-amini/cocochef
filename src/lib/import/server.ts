import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'

import { serverEnv as env } from '@/env.server'
import { requireUserId } from '@/lib/auth/session'
import { clampRecipeTitle, recipeInput } from '@/lib/recipes/model'
import {
	createSharedRecipe,
	findSharedRecipeByUrl,
	saveRecipeForUser,
} from '@/lib/recipes/repository'

import { fetchRecipeHtml, type RelayConfig } from './fetch'
import { rateLimit, withImportSlot } from './rate-limit'
import { canonicalRecipeUrl } from './url'

// Set only where datacenter addresses get blocked, which is every deploy.
function relayConfig(): RelayConfig | undefined {
	return env.IMPORT_RELAY_URL && env.IMPORT_RELAY_TOKEN
		? { url: env.IMPORT_RELAY_URL, token: env.IMPORT_RELAY_TOKEN }
		: undefined
}

// The shared recipe for a page, fetched the first time anyone asks for it.
async function findOrFetch(url: string, sourceUrl: string) {
	const known = await findSharedRecipeByUrl(sourceUrl)

	if (known) return known

	const page = await fetchRecipeHtml(url, relayConfig())

	if (!page) throw new Error("that site won't let us in — try another link")

	if (!page.recipe) throw new Error("couldn't find a recipe on that page")

	const input = recipeInput.safeParse({
		title: clampRecipeTitle(page.recipe.title),
		imageUrl: page.recipe.imageUrl,
		sourceUrl,
		ingredients: page.recipe.ingredients.map(({ raw }) => raw),
		steps: page.recipe.steps,
	})

	if (!input.success) throw new Error("couldn't read a recipe on that page")

	const recipe = await createSharedRecipe({
		...input.data,
		sourceUrl,
	})

	if (!recipe) throw new Error("couldn't save that — try again")

	return recipe
}

function fetchLimited(userId: string, url: string, sourceUrl: string) {
	rateLimit(`user:${userId}`, 10)
	rateLimit(`ip:${getRequestIP() ?? 'unknown'}`, 20)

	return withImportSlot(userId, () => findOrFetch(url, sourceUrl))
}

// Imports a recipe by link. A link pasted to add a recipe goes on the shelf too
// (`keep`); a search result only opens, and saving it is one tap.
export const importRecipe = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			url: z.url({ protocol: /^https?$/ }).max(2000),
			keep: z.boolean().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const userId = await requireUserId()
		const sourceUrl = canonicalRecipeUrl(data.url)

		// A page already in dutch-oven costs nothing to open, so looking through
		// search previews only counts against the limits when a site is fetched.
		const recipe =
			(await findSharedRecipeByUrl(sourceUrl)) ??
			(await fetchLimited(userId, data.url, sourceUrl))

		if (data.keep) await saveRecipeForUser(userId, recipe.id)

		return recipe
	})
