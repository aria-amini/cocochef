import { getAccountId } from '@/lib/auth/session'
import { listGroceriesForUser } from '@/lib/groceries/repository'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'
import { ingredientLinesFor } from '@/lib/recipes/repository'

import { findInPantry, shelfState } from './foods'
import { type Readiness, readinessOf } from './readiness'
import { listPantryForUser } from './repository'
import { lineStatus } from './status'

// Food that spoils within this many days is worth using first.
const soonDays = 3

// The pantry's foods a recipe can count on: not past their time, and marked
// stale once unseen for a while.
function keptNow(pantry: Awaited<ReturnType<typeof listPantryForUser>>) {
	const now = new Date()

	return pantry.flatMap((item) => {
		const shelf = shelfState(item, now)

		return shelf.state === 'expired'
			? []
			: [{ ...item, ...shelf, stale: shelf.state === 'stale' }]
	})
}

// How ready each recipe is to cook, for the shelf to show at a glance.
// Nothing for a visitor, or a kitchen with nothing in it yet.
export async function recipeReadiness(recipeIds: string[]) {
	const ready = new Map<string, Readiness>()
	const accountId = await getAccountId()

	if (!accountId || !recipeIds.length) return ready

	const [pantry, list, lines] = await Promise.all([
		listPantryForUser(accountId),
		listGroceriesForUser(accountId),
		ingredientLinesFor(recipeIds),
	])

	if (!pantry.length) return ready

	const kept = keptNow(pantry)

	for (const [id, recipeLines] of lines) {
		const forIt = list.filter((item) =>
			item.recipes.some((recipe) => recipe.id === id),
		)

		const readiness = readinessOf(recipeLines, kept, forIt)

		if (readiness) ready.set(id, readiness)
	}

	return ready
}

// How much of each recipe the signed-in cook's kitchen has, for a list to
// say at a glance: how many of its foods are home, of how many, and what of
// the kitchen's it would use before it goes. Nothing for a visitor, or a
// kitchen with nothing in it yet.
export async function kitchenStock(recipeIds: string[]) {
	const stock = new Map<
		string,
		{
			have: number
			total: number
			uses: string[]
			need: string[]
			// Each food line as written, and whether the kitchen has it.
			lines: { text: string; have: boolean }[]
		}
	>()

	const accountId = await getAccountId()

	if (!accountId || !recipeIds.length) return stock

	const pantry = await listPantryForUser(accountId)

	if (!pantry.length) return stock

	const kept = keptNow(pantry)
	const lines = await ingredientLinesFor(recipeIds)

	for (const [id, recipeLines] of lines) {
		const food = recipeLines.filter(
			(line) => line.trim() && ingredientHeading(line) === undefined,
		)

		const statuses = food.flatMap((line) => lineStatus(line, kept, []) ?? [])

		// What would go on the list, by its food's name.
		const need = food.flatMap((line) => {
			const status = lineStatus(line, kept, [])

			return status?.kind === 'need' || status?.kind === 'stale'
				? [ingredientSubject(line)]
				: []
		})

		const uses = food.flatMap((line) => {
			const item = findInPantry(line, kept)

			return item &&
				item.spoils &&
				item.level !== 'out' &&
				item.daysLeft <= soonDays
				? [item.name]
				: []
		})

		stock.set(id, {
			have: statuses.filter(
				(status) => status.kind === 'have' || status.kind === 'low',
			).length,
			total: statuses.length,
			uses: [...new Set(uses)],
			need: [...new Set(need)],
			lines: food.map((line) => {
				const status = lineStatus(line, kept, [])

				return {
					text: line,
					have: status?.kind === 'have' || status?.kind === 'low',
				}
			}),
		})
	}

	return stock
}
