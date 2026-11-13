import { asc, inArray } from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import { recipes, recipeSteps } from '@/db/schema'

import { recipeEffort, type RecipeEffort } from './effort'
import { ingredientHeading } from './ingredient-line'
import { ingredientLinesFor } from './repository'

// What each recipe asks of the cook, from its page's times and its steps,
// for a list to say at a glance.
export async function effortFor(
	recipeIds: string[],
	database: Database = getDb(),
) {
	const effort = new Map<string, RecipeEffort>()

	if (!recipeIds.length) return effort

	const [rows, stepRows, lines] = await Promise.all([
		database
			.select({
				id: recipes.id,
				title: recipes.title,
				totalMinutes: recipes.totalMinutes,
				prepMinutes: recipes.prepMinutes,
				servings: recipes.servings,
			})
			.from(recipes)
			.where(inArray(recipes.id, recipeIds)),
		database
			.select({ recipeId: recipeSteps.recipeId, text: recipeSteps.text })
			.from(recipeSteps)
			.where(inArray(recipeSteps.recipeId, recipeIds))
			.orderBy(asc(recipeSteps.position)),
		ingredientLinesFor(recipeIds, database),
	])

	const steps = new Map<string, string[]>()

	for (const row of stepRows)
		steps.set(row.recipeId, [...(steps.get(row.recipeId) ?? []), row.text])

	for (const recipe of rows)
		effort.set(
			recipe.id,
			recipeEffort({
				...recipe,
				steps: steps.get(recipe.id) ?? [],
				foods: (lines.get(recipe.id) ?? []).filter(
					(line) => line.trim() && ingredientHeading(line) === undefined,
				),
			}),
		)

	return effort
}
