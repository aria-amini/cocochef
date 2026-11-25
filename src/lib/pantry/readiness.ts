import { groceryLine } from '@/lib/groceries/list'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'

import { findInPantry } from './foods'
import { type KeptFood, lineStatus } from './status'

export type Readiness = { home: number; listed: number; total: number }

// How ready a recipe is to cook, counted as its own page counts it: of the
// foods it needs, how many are home, and how many more are on the list for
// it (in the cart counts: bought, not put away yet). Undefined when it needs
// nothing that's ever bought.
export function readinessOf(
	lines: readonly string[],
	kept: readonly KeptFood[],
	// The grocery lines kept for this recipe, waiting or in the cart.
	listed: readonly { text: string }[],
): Readiness | undefined {
	const onList = listed.map((item) => ({
		name: ingredientSubject(groceryLine(item.text)),
	}))

	let home = 0
	let onIt = 0
	let total = 0

	for (const line of lines) {
		if (!line.trim() || ingredientHeading(line) !== undefined) continue

		// Water and the like are never bought, so never missing.
		if (!lineStatus(line, kept, [])) continue

		total++

		if (findInPantry(line, onList)) {
			onIt++
			continue
		}

		const have = findInPantry(line, kept)

		if (have && have.level !== 'out' && !have.stale) home++
	}

	return total ? { home, listed: onIt, total } : undefined
}
