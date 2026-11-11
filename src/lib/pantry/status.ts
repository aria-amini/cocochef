import { groceryLine } from '@/lib/groceries/list'
import { ingredientSubject } from '@/lib/recipes/ingredient-line'

import { findInPantry, neverBuy } from './foods'
import type { PantryLevel } from './model'

// A pantry item as a recipe sees it: how much is left, and whether the cook
// said so recently enough to trust.
export type KeptFood = {
	name: string
	level: PantryLevel
	stale: boolean
	confirmedAt: Date
}

// What a recipe line means for the cook's kitchen: already on the grocery
// list, had (plenty, or running low), had once but not lately, or needed.
export type LineStatus =
	| { kind: 'list' }
	| { kind: 'have' }
	| { kind: 'low' }
	| { kind: 'stale'; since: Date }
	| { kind: 'need' }

// Nothing for water and ice, which are never bought.
export function lineStatus(
	line: string,
	pantry: readonly KeptFood[],
	waiting: readonly string[],
): LineStatus | undefined {
	if (neverBuy(line)) return undefined

	const onList = waiting.map((text) => ({
		name: ingredientSubject(groceryLine(text)),
	}))

	if (findInPantry(line, onList)) return { kind: 'list' }

	const kept = findInPantry(line, pantry)

	if (!kept || kept.level === 'out') return { kind: 'need' }

	if (kept.stale) return { kind: 'stale', since: kept.confirmedAt }

	return kept.level === 'low' ? { kind: 'low' } : { kind: 'have' }
}

// Whether a line should go on the list: needed, running low, or not seen in
// a while. One already on the list, or had, stays off.
export function wantsBuying(status: LineStatus | undefined) {
	return (
		status?.kind === 'need' ||
		status?.kind === 'low' ||
		status?.kind === 'stale'
	)
}

const monthFormat = new Intl.DateTimeFormat('en', { month: 'long' })

// "had it in march": when the cook last said so.
export const hadItIn = (since: Date) =>
	`had it in ${monthFormat.format(since).toLowerCase()}`
