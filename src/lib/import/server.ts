import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'

import { serverEnv as env } from '@/env.server'
import { getViewerId, requireAccountId } from '@/lib/auth/session'
import { createRateLimiter, createSlots } from '@/lib/rate-limit'
import { clampRecipeTitle, recipeInput } from '@/lib/recipes/model'
import {
	addMissingSourceNotes,
	createSharedRecipe,
	findSharedRecipeByUrl,
	saveRecipeForUser,
} from '@/lib/recipes/repository'

import { fetchRecipeHtml, type RelayConfig } from './fetch'
import { canonicalRecipeUrl } from './url'

const userLimit = createRateLimiter({
	limit: 10,
	message: 'too many imports — wait a minute and try again',
})

const ipLimit = createRateLimiter({
	limit: 20,
	message: 'too many imports — wait a minute and try again',
})

const withImportSlot = createSlots({
	max: 4,
	maxPerKey: 2,
	message: 'too many imports in flight — try again in a moment',
})

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
		sourceNotes: page.recipe.sourceNotes,
	})

	if (!recipe) throw new Error("couldn't save that — try again")

	return recipe
}

function fetchLimited(userId: string, url: string, sourceUrl: string) {
	userLimit(userId)
	ipLimit(getRequestIP() ?? 'unknown')

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
		const viewerId = data.keep
			? await requireAccountId('save recipes')
			: await getViewerId()

		// Visitors share one id, so they are limited per request address instead.
		const userId =
			viewerId === 'visitor'
				? `visitor:${getRequestIP() ?? 'unknown'}`
				: viewerId

		const sourceUrl = canonicalRecipeUrl(data.url)

		// A page already in dutch-oven costs nothing to open, so looking through
		// search previews only counts against the limits when a site is fetched.
		const known = await findSharedRecipeByUrl(sourceUrl)

		// Explicitly re-importing a previously saved URL can fill notes that
		// older versions did not capture. A page with none is marked with an
		// empty string, so it is looked at once. A failed refresh keeps it usable.
		if (known && data.keep && known.sourceNotes === null) {
			try {
				userLimit(userId)
				ipLimit(getRequestIP() ?? 'unknown')

				const page = await withImportSlot(userId, () =>
					fetchRecipeHtml(data.url, relayConfig()),
				)

				if (page?.recipe)
					await addMissingSourceNotes(known.id, page.recipe.sourceNotes ?? '')
			} catch {
				// Existing recipe remains available if the site cannot be fetched.
			}
		}

		const recipe = known ?? (await fetchLimited(userId, data.url, sourceUrl))

		if (data.keep) await saveRecipeForUser(userId, recipe.id)

		return recipe
	})
