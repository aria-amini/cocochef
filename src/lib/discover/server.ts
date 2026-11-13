import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { MealTags } from '@/lib/assistant/meal-parts'
import { withMealTags } from '@/lib/assistant/meal-tags.server'
import { getViewerId } from '@/lib/auth/session'
import { canonicalRecipeUrl } from '@/lib/import/url'
import { kitchenStock } from '@/lib/pantry/stock.server'
import type { RecipeEffort } from '@/lib/recipes/effort'
import { effortFor } from '@/lib/recipes/effort.server'
import { recipeSorts } from '@/lib/recipes/loved'
import {
	findLovedRecipesForUser,
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
import { recipeSites, siteNameFor } from './sites'

const siteNames = new Map(recipeSites.map((site) => [site.id, site.name]))

function canonical(url: string) {
	try {
		return canonicalRecipeUrl(url)
	} catch {
		return url
	}
}

type SharedRecipe = Awaited<ReturnType<typeof popularSharedRecipes>>[number]

// A recipe to show: in cocochef (`recipeId`) or a page on a site (`url`).
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
	// How its readers rated it, once its page has been read.
	rating?: { value: number; count: number } | undefined
	// The parts of a meal it was tagged with; null when it isn't a meal.
	tags?: MealTags | null | undefined
	// How long it takes, when its page says.
	totalMinutes?: number | undefined
	// How much of it the cook's kitchen has, and what of it it would use up.
	stock?:
		| {
				have: number
				total: number
				uses: string[]
				need: string[]
				lines: { text: string; have: boolean }[]
		  }
		| undefined
	// What it asks of the cook: hands-on and waiting time, servings, keeping.
	effort?: RecipeEffort | undefined
}

const ratingOf = (recipe: {
	ratingValue: number | null
	ratingCount: number | null
}) =>
	recipe.ratingValue !== null && recipe.ratingCount
		? { value: recipe.ratingValue, count: recipe.ratingCount }
		: undefined

const fromShared = (recipe: SharedRecipe): FoundRecipe => ({
	recipeId: recipe.id,
	url: recipe.sourceUrl ?? undefined,
	title: recipe.title,
	imageUrl: recipe.imageUrl ?? undefined,
	siteName: siteNameFor(recipe.sourceUrl) ?? 'cocochef',
	saved: false,
	draft: false,
	ingredientMatches: [],
	rating: ratingOf(recipe),
	totalMinutes: recipe.totalMinutes ?? undefined,
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

// Every recipe this user could cook or start from. Recipes in cocochef come
// first, matched by name or ingredient: the user's own shelf (`saved`), then
// shared ones. Pages on the recipe sites that nobody has brought in yet follow,
// matched by name only, since the index knows nothing else about them.
//
// Sorted by rating, it is every rated recipe instead, with or without words,
// most loved or most rated first. Site pages nobody has brought in have no
// rating yet, so they are left out.
export const searchRecipes = createServerFn({ method: 'GET' })
	.validator(
		z.object({
			q: z.string().trim().max(80),
			sort: z.enum(recipeSorts).optional(),
		}),
	)
	.handler(async ({ data }) => {
		const userId = await getViewerId()

		const found =
			data.sort !== undefined
				? await findLovedRecipesForUser(userId, data.q, data.sort, 120)
				: data.q
					? await findRecipesForUser(userId, data.q, 80)
					: []

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
			results: await withStock(
				await withMealTags([
					...found.map((recipe, index): FoundRecipe => ({
						...fromShared(recipe),
						imageUrl: images[index] ?? undefined,
						// On your shelf, the site shows only while the source link is
						// still set; a recipe made your own names no site.
						siteName:
							siteNameFor(recipe.sourceUrl) ??
							(recipe.owned || recipe.saved ? '' : 'cocochef'),
						saved: recipe.saved,
						draft: recipe.owned && !recipe.finalizedAt,
						ingredientMatches: recipe.ingredientMatches,
					})),
					...(data.sort === undefined
						? await notYetShared(searchRecipeLinks(links, data.q, 120))
						: []
					).map(fromLink),
				]),
			),
		}
	})

const popularLimit = 120

const dayMs = 24 * 60 * 60 * 1000

// What others keep and cook, topped up with recipes from the sites so the
// shelf never ends in an empty row while few people use cocochef.
export const popularRecipes = createServerFn({ method: 'GET' }).handler(
	async () => {
		const shared = await popularSharedRecipes(await getViewerId(), popularLimit)

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
			results: await withStock(
				await withMealTags([
					...shared.map(fromShared),
					...featured.map(fromLink),
				]),
			),
		}
	},
)

// Each recipe in cocochef with how much of it the kitchen has, and what it
// asks of the cook.
async function withStock<T extends FoundRecipe>(found: T[]) {
	const ids = found.flatMap((recipe) => recipe.recipeId ?? [])
	const [stock, effort] = await Promise.all([kitchenStock(ids), effortFor(ids)])

	return found.map((recipe) => {
		if (!recipe.recipeId) return recipe

		const held = stock.get(recipe.recipeId)
		const asks = effort.get(recipe.recipeId)

		return { ...recipe, stock: held ?? recipe.stock, effort: asks }
	})
}
