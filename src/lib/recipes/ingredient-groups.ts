import { categorizeIngredient, sectionSprite } from '@/lib/pantry/catalog'
import {
	pantryCategories,
	pantryCategoryLabels,
	type PantryCategory,
} from '@/lib/pantry/model'

import { ingredientHeading } from './ingredient-line'
import type { IngredientCategories } from './model'

export function ingredientCategory(line: string): PantryCategory {
	return categorizeIngredient(line.split(',')[0] ?? line)
}

// Whether the cook (or the paste) laid the ingredients out in sections of
// their own. A lone "Ingredients" heading is a label, not a section.
export function hasOwnSections(lines: string[]) {
	return lines.some((line) => {
		const heading = ingredientHeading(line)

		return heading !== undefined && !/^ingredients?$/i.test(heading)
	})
}

export type IngredientViewRow =
	| {
			kind: 'heading'
			key: string
			text: string
			category?: PantryCategory
			// The picture beside a category heading, from the food under it.
			sprite?: string
	  }
	| { kind: 'ingredient'; key: string; text: string; index: number }

// Grouped mode has only category headings. Source order retains the recipe's
// own sections. Both views keep each ingredient's original index for cooking.
export function ingredientViewRows(
	lines: string[],
	grouped: boolean,
	// The cook's own grouping, keyed by line; the rest is guessed from the food.
	categories: IngredientCategories = {},
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
				row.kind === 'ingredient' &&
				(categories[row.text] ?? ingredientCategory(row.text)) === category,
		)

		return items.length
			? [
					{
						kind: 'heading',
						key: `category:${category}`,
						text: pantryCategoryLabels[category],
						category,
						sprite: sectionSprite(
							items.map((item) => item.text),
							category,
						),
					},
					...items,
				]
			: []
	})
}
