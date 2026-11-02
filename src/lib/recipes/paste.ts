import {
	formatIngredientHeading,
	parseIngredientLine,
} from '@/lib/recipes/ingredient-line'
import { clampRecipeTitle } from '@/lib/recipes/model'

export type PastedRecipe = {
	title: string
	ingredients: string[]
	steps: string[]
}

const ingredientsHeading =
	/^(?:ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|shopping list)\s*:?$/i

const stepsHeading =
	/^(?:method|directions?|instructions?|steps?|preparation|prep|how to make(?: it)?)\s*:?$/i

// A pasted method often arrives numbered ("1. boil", "step 2: stir"); the row
// number already says that.
export const leadingNumber = /^\s*(?:step\s*)?\d+\s*[.):-]\s*/i

const bullet = /^\s*[-•*–·▢□]\s*/

// "for the sauce:" inside an ingredient list names a group, not a food.
const groupLabel = /^(?:for (?:the )?)?[^\d:]{1,40}:$/i

// A line as it goes on the ingredient list: without its bullet, and a group
// label ("for the sauce:") as a section heading.
function ingredientFromPaste(line: string) {
	const item = line.trim().replace(bullet, '')

	return groupLabel.test(item)
		? formatIngredientHeading(item.replace(/:$/, ''))
		: item
}

// A list pasted into the ingredients, one line per row.
export function pastedIngredients(text: string) {
	return text.split(/\r?\n/).map(ingredientFromPaste).filter(Boolean)
}

// Starts with an amount, or is short enough to be one on a list.
function looksLikeIngredient(line: string) {
	if (parseIngredientLine(line).quantity !== undefined) return true

	return line.length <= 40 && !/[.!?]$/.test(line)
}

// A recipe copied from a note, a message or a page, as plain lines. Headings
// like "ingredients" and "method" split it when present; otherwise each line is
// sorted by whether it reads like an amount or an instruction. The first line
// names the recipe unless it is already one of those.
export function parsePastedRecipe(text: string): PastedRecipe {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	let title = ''
	let section: 'ingredients' | 'steps' | undefined
	const ingredients: string[] = []
	const steps: string[] = []

	for (const [index, line] of lines.entries()) {
		if (ingredientsHeading.test(line)) {
			section = 'ingredients'
			continue
		}

		if (stepsHeading.test(line)) {
			section = 'steps'
			continue
		}

		if (index === 0) {
			title = line.replace(bullet, '')
			continue
		}

		if (section === 'steps') {
			steps.push(line.replace(leadingNumber, '').replace(bullet, ''))
			continue
		}

		const item = line.replace(bullet, '')

		if (groupLabel.test(item)) ingredients.push(ingredientFromPaste(item))
		else if (
			section !== 'ingredients' &&
			(leadingNumber.test(line) || !looksLikeIngredient(item))
		)
			steps.push(line.replace(leadingNumber, '').replace(bullet, ''))
		else ingredients.push(item)
	}

	return { title: clampRecipeTitle(title), ingredients, steps }
}

// Worth parsing: more than a name on one line.
export function isPastedRecipe(text: string) {
	return text.trim().includes('\n')
}
