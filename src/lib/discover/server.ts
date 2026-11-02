import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from '@/lib/auth/session'
import { canonicalRecipeUrl } from '@/lib/import/url'
import {
	findRecipesForUser,
	popularSharedRecipes,
	sharedRecipeUrls,
} from '@/lib/recipes/repository'
import { resolveStoredImage } from '@/lib/s3'

import { recipeIndex } from './crawl'
import {
	featuredRecipeLinks,
	searchRecipeLinks,
	type RecipeLink,
} from './recipe-index'
import { recipeSites } from './sites'

const siteNames = new Map(recipeSites.map((site) => [site.id, site.name]))

const bareHost = (url: string) => new URL(url).hostname.replace(/^www\./, '')

// Sites are matched by the hostname of their sitemap, not by their id.
const siteHosts = recipeSites.map((site) => ({
	host: bareHost(site.sitemap),
	name: site.name,
}))

function siteNameFor(url: string | null) {
	if (!url) return undefined

	try {
		const host = bareHost(url)

		return (
			siteHosts.find(
				(site) => host === site.host || host.endsWith(`.${site.host}`),
			)?.name ?? host
		)
	} catch {
		return undefined
	}
}

function canonical(url: string) {
	try {
		return canonicalRecipeUrl(url)
	} catch {
		return url
	}
}

type SharedRecipe = Awaited<ReturnType<typeof popularSharedRecipes>>[number]

// A recipe to show: in dutch-oven (`recipeId`) or a page on a site (`url`).
export type FoundRecipe = {
	recipeId?: string | undefined
	url?: string | undefined
	title: string
	imageUrl?: string | undefined
	siteName: string
	saved: boolean
	draft: boolean
	// Search words only its ingredients held.
	ingredientMatches: string[]
}

const fromShared = (recipe: SharedRecipe): FoundRecipe => ({
	recipeId: recipe.id,
	url: recipe.sourceUrl ?? undefined,
	title: recipe.title,
	imageUrl: recipe.imageUrl ?? undefined,
	siteName: siteNameFor(recipe.sourceUrl) ?? 'dutch-oven',
	saved: false,
	draft: false,
	ingredientMatches: [],
})

const fromLink = (link: RecipeLink): FoundRecipe => ({
	recipeId: undefined,
	url: link.url,
	title: link.title,
	imageUrl: link.imageUrl,
	siteName: siteNames.get(link.siteId) ?? link.siteId,
	saved: false,
	draft: false,
	ingredientMatches: [],
})

// Index pages nobody has brought in yet; the shared copy shows instead.
async function notYetShared(links: RecipeLink[]) {
	const known = new Set(
		await sharedRecipeUrls(links.map((link) => canonical(link.url))),
	)

	return links.filter((link) => !known.has(canonical(link.url)))
}

// Every recipe this user could cook or start from. Recipes in dutch-oven come
// first, matched by name or ingredient: the user's own shelf (`saved`), then
// shared ones. Pages on the recipe sites that nobody has brought in yet follow,
// matched by name only, since the index knows nothing else about them.
export const searchRecipes = createServerFn({ method: 'GET' })
	.validator(z.object({ q: z.string().trim().max(80) }))
	.handler(async ({ data }) => {
		const userId = await requireUserId()

		const found = data.q ? await findRecipesForUser(userId, data.q, 16) : []

		// Uploaded photos are stored as bucket keys; clients need a fetchable URL.
		const images = await Promise.all(
			found.map(({ imageUrl }) =>
				imageUrl
					? resolveStoredImage(imageUrl).catch(() => null)
					: Promise.resolve(null),
			),
		)

		const { links, warming } = recipeIndex()

		return {
			warming,
			results: [
				...found.map((recipe, index): FoundRecipe => ({
					...fromShared(recipe),
					imageUrl: images[index] ?? undefined,
					siteName: recipe.owned
						? 'your recipe'
						: (siteNameFor(recipe.sourceUrl) ?? 'dutch-oven'),
					saved: recipe.saved,
					draft: recipe.owned && !recipe.finalizedAt,
					ingredientMatches: recipe.ingredientMatches,
				})),
				...(await notYetShared(searchRecipeLinks(links, data.q))).map(fromLink),
			],
		}
	})

const popularLimit = 12

const dayMs = 24 * 60 * 60 * 1000

// What others keep and cook, topped up with recipes from the sites so the
// shelf never ends in an empty row while few people use dutch-oven.
export const popularRecipes = createServerFn({ method: 'GET' }).handler(
	async () => {
		const shared = await popularSharedRecipes(
			await requireUserId(),
			popularLimit,
		)

		const { links, warming } = recipeIndex()
		const missing = popularLimit - shared.length

		// Twice the gap, since some of the picks may be shared already.
		const featured =
			missing > 0
				? (
						await notYetShared(
							featuredRecipeLinks(
								links,
								missing * 2,
								Math.floor(Date.now() / dayMs),
							),
						)
					).slice(0, missing)
				: []

		return {
			warming,
			results: [...shared.map(fromShared), ...featured.map(fromLink)],
		}
	},
)
