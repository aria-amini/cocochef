import { type Database, getDb } from '@/db/connection'
import { mealTags as mealTagsTable } from '@/db/schema'

import {
	groupProteins,
	mealTags,
	type MealTags,
	placeCuisines,
} from './meal-parts'

// Saved tags by page (or `recipe:<id>`); undefined for what isn't a meal.
type Saved = ReadonlyMap<string, MealTags | undefined>

const savedForMs = 60_000

let saved: { at: number; tags: Saved } | undefined

// The parts a classifier saved for each recipe (scripts/tag-eval.ts), re-read
// at most once a minute.
async function savedTags(database: Database) {
	if (saved && Date.now() - saved.at < savedForMs) return saved.tags

	const rows = await database.select().from(mealTagsTable)

	saved = {
		at: Date.now(),
		tags: new Map(
			rows.map((row) => [
				row.key,
				row.meal
					? {
							// Older tags name a country without its region.
							cuisines: placeCuisines(row.cuisines),
							flavors: row.flavors,
							proteins: groupProteins(row.proteins),
							forms: row.forms,
						}
					: undefined,
			]),
		),
	}

	return saved.tags
}

// A recipe's saved tags, or what its title's words name until it has some.
const tagsFor = (tags: Saved, key: string, title: string) =>
	tags.has(key) ? tags.get(key) : mealTags(title)

// A failed read leaves search working on title words, and the next search
// tries the table again.
async function savedTagsOrNone(database: Database): Promise<Saved> {
	try {
		return await savedTags(database)
	} catch (error) {
		console.error(
			`meal tags unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
		)

		return new Map()
	}
}

// The parts each recipe (by meal tag key) was tagged with; undefined for what
// isn't a meal.
export async function mealTagsByKey(
	recipes: readonly { key: string; title: string }[],
	database: Database = getDb(),
) {
	const tags = await savedTagsOrNone(database)

	return recipes.map((recipe) => tagsFor(tags, recipe.key, recipe.title))
}

// Found recipes with the parts they were tagged with, for the search box's
// bubbles: null for what isn't a meal.
export async function withMealTags<
	T extends {
		recipeId?: string | undefined
		url?: string | undefined
		title: string
	},
>(found: T[], database: Database = getDb()) {
	const tags = await savedTagsOrNone(database)

	return found.map((recipe) => ({
		...recipe,
		tags:
			tagsFor(tags, recipe.url ?? `recipe:${recipe.recipeId}`, recipe.title) ??
			null,
	}))
}
