import { categorizeIngredient } from '@/lib/pantry/catalog'
import {
	pantryCategories,
	pantryCategoryLabels,
	type PantryCategory,
} from '@/lib/pantry/model'

import { ingredientHeading } from './ingredient-line'

export function ingredientCategory(line: string): PantryCategory {
	return categorizeIngredient(line.split(',')[0] ?? line)
}

export type IngredientViewRow =
	| { kind: 'heading'; key: string; text: string; category?: PantryCategory }
	| { kind: 'ingredient'; key: string; text: string; index: number }

// Grouped mode has only category headings. Source order retains the recipe's
// own sections. Both views keep each ingredient's original index for cooking.
export function ingredientViewRows(
	lines: string[],
	grouped: boolean,
): IngredientViewRow[] {
	const source: IngredientViewRow[] = lines.flatMap(
		(text, index): IngredientViewRow[] => {
			const heading = ingredientHeading(text)

			if (heading !== undefined)
				return /^ingredients?$/i.test(heading)
					? []
					: [{ kind: 'heading', key: `source:${index}`, text: heading }]

			return [{ kind: 'ingredient', key: `ingredient:${index}`, text, index }]
		},
	)

	if (!grouped) return source

	return pantryCategories.flatMap((category): IngredientViewRow[] => {
		const items = source.filter(
			(row) =>
				row.kind === 'ingredient' && ingredientCategory(row.text) === category,
		)

		return items.length
			? [
					{
						kind: 'heading',
						key: `category:${category}`,
						text: pantryCategoryLabels[category],
						category,
					},
					...items,
				]
			: []
	})
}
