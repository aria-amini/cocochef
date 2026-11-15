import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
	countParts,
	fitsPicks,
	hasPicks,
	type MealPicks,
	type MealTags,
} from '@/lib/assistant/meal-parts'
import { mealTagsByKey, withMealTags } from '@/lib/assistant/meal-tags.server'
import { getViewerId } from '@/lib/auth/session'
import { kitchenStock } from '@/lib/pantry/stock.server'
import type { RecipeEffort } from '@/lib/recipes/effort'
import { effortFor } from '@/lib/recipes/effort.server'
import { recipeSorts } from '@/lib/recipes/loved'
import {
	findVisibleRecipeKeys,
	findVisibleRecipesById,
	popularSharedRecipes,
	type RecipeSearch,
} from '@/lib/recipes/repository'
import { resolveStoredImage } from '@/lib/s3'

import { siteNameFor } from './sites'

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

const names = z.array(z.string().max(60)).max(100).optional()

const mealPicks = z
	.object({ cuisine: names, protein: names, form: names })
	.default({})

// The first `limit` recipes a search matches once the meal picks narrow them,
// and the meals among all its matches, for the bubbles to count. The picks
// narrow every match, so a cuisine few recipes have is found however far down
// the list they sit.
async function narrowedSearch(
	userId: string,
	search: RecipeSearch,
	picks: MealPicks,
	limit: number,
) {
	const matches = await findVisibleRecipeKeys(userId, search)
	const tags = await mealTagsByKey(matches)

	const kept = hasPicks(picks)
		? matches.filter((_, index) => {
				const meal = tags[index]

				return meal !== undefined && fitsPicks(meal, picks)
			})
		: matches

	const found = await findVisibleRecipesById(
		userId,
		search,
		kept.slice(0, limit).map((match) => match.id),
	)

	return { found, meals: tags.flatMap((meal) => meal ?? []) }
}

// Every recipe this user could cook or start from, matched by name or
// ingredient: the user's own shelf (`saved`), then shared ones.
//
// Sorted by rating, it is every rated recipe instead, with or without words,
// most loved or most rated first. Picked meal parts (cuisine, protein, kind
// of dish) narrow every recipe in cocochef; with no words or sort, they pick
// from all of them, most loved first.
export const searchRecipes = createServerFn({ method: 'GET' })
	.validator(
		z.object({
			q: z.string().trim().max(80),
			sort: z.enum(recipeSorts).optional(),
			picks: mealPicks,
		}),
	)
	.handler(async ({ data }) => {
		const userId = await getViewerId()

		const asked =
			data.q !== '' || data.sort !== undefined || hasPicks(data.picks)

		const { found, meals } = asked
			? await narrowedSearch(
					userId,
					{ query: data.q, sort: data.sort },
					data.picks,
					data.sort !== undefined ? 120 : 80,
				)
			: { found: [], meals: [] }

		const counts = asked ? countParts(meals, data.picks) : undefined

		// Uploaded photos are stored as bucket keys; clients need a fetchable URL.
		const images = await Promise.all(
			found.map(({ imageUrl }) =>
				imageUrl
					? resolveStoredImage(imageUrl).catch(() => null)
					: Promise.resolve(null),
			),
		)

		return {
			counts,
			results: await withStock(
				await withMealTags(
					found.map((recipe, index): FoundRecipe => ({
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
				),
			),
		}
	})

const popularLimit = 120

// The most loved shared recipes, for an empty search to browse.
export const popularRecipes = createServerFn({ method: 'GET' }).handler(
	async () => {
		const userId = await getViewerId()
		const shared = await popularSharedRecipes(userId, popularLimit)

		// The bubbles offer what all of cocochef holds, not only these few.
		const counts = countParts(
			(
				await mealTagsByKey(await findVisibleRecipeKeys(userId, { query: '' }))
			).flatMap((meal) => meal ?? []),
			{},
		)

		return {
			counts,
			results: await withStock(await withMealTags(shared.map(fromShared))),
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
