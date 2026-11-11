import { createServerFn } from '@tanstack/react-start'

import { getCurrentSession } from '@/lib/auth/session'
import { ingredientHeading } from '@/lib/recipes/ingredient-line'

import {
	amountRequest,
	amountsFromModel,
	mockAmounts,
	modelAmounts,
	wantsAmount,
} from './amounts'
import {
	amountsInstructions,
	askModel,
	regroupInstructions,
	sectionLinesInstructions,
	sectionNameInstructions,
	sectionsInstructions,
} from './model'
import {
	mockRegroup,
	modelRegroup,
	regroupFromModel,
	regroupRequest,
} from './regroup'
import { markPantryForUser } from './repository'
import {
	mockSectionLines,
	mockSectionName,
	mockSuggestions,
	modelLines,
	modelSectionName,
	modelSections,
	sectionLinesFromModel,
	sectionLinesRequest,
	sectionNameFromModel,
	sectionNameRequest,
	sectionsFromModel,
	suggestionRequest,
	suggestionTitleMin,
} from './suggestions'

// Lines that name a food, headings and blanks left out.
const foodLines = (lines: string[]) =>
	lines.filter((line) => line.trim() && ingredientHeading(line) === undefined)

// Each suggestion asks the model first. Without a key, or when the call
// fails, the mock source answers instead, so the editor never waits on an
// error.

// Sections the editor offers under the ingredients. Suggesting never creates a
// guest session: a visitor gets them unmarked.
export const suggestIngredientSections = createServerFn({ method: 'POST' })
	.validator(suggestionRequest)
	.handler(async ({ data }) => {
		if (data.title.length < suggestionTitleMin) return { sections: [] }

		const [session, answer] = await Promise.all([
			getCurrentSession(),
			askModel(
				'sections',
				sectionsInstructions,
				JSON.stringify(data),
				modelSections,
			),
		])

		const sections = answer
			? sectionsFromModel(data, answer)
			: mockSuggestions(data)

		return { sections: await markPantryForUser(session?.user.id, sections) }
	})

// The grouping the editor offers for the ingredients, from the steps they go
// into.
export const regroupIngredients = createServerFn({ method: 'POST' })
	.validator(regroupRequest)
	.handler(async ({ data }) => {
		if (foodLines(data.ingredients).length < 2 || !data.steps.length)
			return { groups: [] }

		const answer = await askModel(
			'regroup',
			regroupInstructions,
			JSON.stringify({
				ingredients: data.ingredients.map((line, index) => ({ index, line })),
				steps: data.steps.map((step, index) => ({ index, step })),
			}),
			modelRegroup,
		)

		return answer ? regroupFromModel(data, answer) : mockRegroup(data)
	})

// Lines for a section the cook has just named, shown inside it.
export const suggestSectionLines = createServerFn({ method: 'POST' })
	.validator(sectionLinesRequest)
	.handler(async ({ data }) => {
		const answer = await askModel(
			'section-lines',
			sectionLinesInstructions,
			JSON.stringify(data),
			modelLines,
		)

		return {
			lines: answer
				? sectionLinesFromModel(data, answer)
				: mockSectionLines(data),
		}
	})

// A likely amount for each line written without one.
export const suggestAmounts = createServerFn({ method: 'POST' })
	.validator(amountRequest)
	.handler(async ({ data }) => {
		if (!data.lines.some(wantsAmount))
			return { amounts: data.lines.map(() => null) }

		const answer = await askModel(
			'amounts',
			amountsInstructions,
			JSON.stringify({
				title: data.title,
				lines: data.lines.map((line, index) => ({ index, line })),
			}),
			modelAmounts,
		)

		return answer ? amountsFromModel(data, answer) : mockAmounts(data)
	})

// A name for a section that has none, from what is in it.
export const suggestSectionName = createServerFn({ method: 'POST' })
	.validator(sectionNameRequest)
	.handler(async ({ data }) => {
		// One food says nothing about what a section is for.
		if (foodLines(data.lines).length < 2) return { name: null }

		const answer = await askModel(
			'section-name',
			sectionNameInstructions,
			JSON.stringify(data),
			modelSectionName,
		)

		return {
			name: answer ? sectionNameFromModel(answer) : mockSectionName(data),
		}
	})
