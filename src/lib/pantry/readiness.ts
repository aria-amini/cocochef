import { groceryLine, shoppingLine } from '@/lib/groceries/list'
import { sameItem } from '@/lib/groceries/model'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'

import { findInPantry } from './foods'
import { type KeptFood, lineStatus } from './status'

export type Readiness = { home: number; listed: number; total: number }

// The recipe's food, without its section names, and each food once, as the
// list would take it: salt in the dough and the filling is one salt.
export function foodsOf(lines: readonly string[]) {
	const seen = new Set<string>()

	return lines.filter((line) => {
		if (!line.trim() || ingredientHeading(line) !== undefined) return false

		const key = sameItem(shoppingLine(line))

		if (seen.has(key)) return false
		seen.add(key)

		return true
	})
}

// How ready a recipe is to cook, counted as its own page counts it: of the
// foods it needs, how many are home, and how many more are on the list for
// it (in the cart counts: bought, not put away yet). A food the cook skipped
// for it isn't needed. Undefined when it needs nothing that's ever bought.
export function readinessOf(
	lines: readonly string[],
	kept: readonly KeptFood[],
	// The grocery lines kept for this recipe, waiting or in the cart.
	listed: readonly { text: string }[],
	// What the cook is doing without, while it's in progress.
	skipped: readonly string[] = [],
): Readiness | undefined {
	const onList = listed.map((item) => ({
		name: ingredientSubject(groceryLine(item.text)),
	}))

	let home = 0
	let onIt = 0
	let total = 0

	for (const line of foodsOf(lines)) {
		// Water and the like are never bought, so never missing.
		if (!lineStatus(line, kept, [])) continue

		const have = findInPantry(line, kept)

		if (findInPantry(line, onList)) onIt++
		else if (have && have.level !== 'out' && !have.stale) home++
		else if (skipped.includes(line)) continue

		total++
	}

	return total ? { home, listed: onIt, total } : undefined
}
