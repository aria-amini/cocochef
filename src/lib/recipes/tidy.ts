import type { LanguageModel } from 'ai'
import { z } from 'zod'

import { AiTaskError, runTask } from '@/lib/ai/run-task'

import { formatIngredientHeading, ingredientHeading } from './ingredient-line'
import { clampRecipeTitle, recipeNotesMax } from './model'
import { bullet, leadingNumber, parsePastedRecipe } from './paste'
import { formatSubStep, stepRows } from './step-groups'
import { tidyInputMax, type TidyRecipeInput } from './tidy-input'

// ===== Input =====

function sourceText(input: TidyRecipeInput) {
	if ('text' in input) return input.text

	return [
		`title: ${input.title}`,
		'ingredients:',
		...input.ingredients.map((line) => `- ${line}`),
		'steps:',
		...stepRows(input.steps).flatMap((row) => [
			`${row.label}. ${row.text}`,
			...(row.kind === 'group'
				? row.children.map((child) => `    - ${child.text}`)
				: []),
		]),
		...(input.notes ? ['notes:', input.notes] : []),
	].join('\n')
}

// ===== Output =====

// What the model fills in. Sections are structure, not "## " markers, so the
// storage format stays ours to write.
const tidyOutput = z.object({
	title: z.string(),
	sections: z.array(
		z.object({
			heading: z.string().nullable(),
			items: z.array(z.string()),
		}),
	),
	steps: z.array(z.object({ text: z.string(), substeps: z.array(z.string()) })),
	notes: z.string(),
})

export type TidyOutput = z.infer<typeof tidyOutput>

export type TidiedRecipe = {
	title: string
	ingredients: string[]
	steps: string[]
	notes: string | undefined
}

const system = `You tidy cooking recipes for a recipe app. The input is a recipe pasted from anywhere, or one already saved. Return it cleaned up.

Ignore checkbox marks like "[x]". Never invent, change, convert or drop an amount, unit, temperature, time or ingredient. Copy each ingredient's text exactly as written: "1½ cups" stays "1½ cups", and "½" is never rewritten as "1/2".

- title: the dish's short name, keeping a helpful descriptor from the source when it has one ("Ash Reshteh (Persian noodle and herb soup)"). No site names, no "best ever" hype.
- sections: the ingredients, grouped by when the method uses them, in the order a cook reaches for them (for example: aromatics, legumes, herbs and greens, noodles, to finish). Always make two or more sections for a list of more than eight ingredients. A heading in the source such as "Ingredients" is not a grouping, so ignore it; a heading such as "For the sauce" or "Garnish" is one. Only a short list of one component is a single section with a null heading. Never add a section called "Ingredients". Each ingredient is its own item, like "2 tbsp olive oil, divided". Merge an ingredient listed twice only when both lines are identical; keep it in each section if it is used in more than one.
- steps: the method in order. Every top-level numbered step of the source is its own step; never merge neighbours like "Soak beans" and "Soak rice", and never merge the items of a list such as the rice instructions. A step that has sub-steps keeps its title as its text and lists the sub-steps, each a complete instruction and in order, in substeps; a step with none has an empty substeps. No numbering, no "step 1" and no headings in any text. A heading above a numbered list ("Prep", "Optional: Rice Instructions") is not a step and never a parent step: its numbered items stay top-level steps of their own, and under an optional heading each one ends with "(optional)". Split sentences that were run together. Remove repeated lines, filler, backstory, ads, "jump to recipe", ratings, nutrition tables, author bios and reader comments. A prep section comes before the cooking steps.
- notes: only tips, storage, substitutions, serving ideas and an equipment list that are in the input, as short plain sentences. Write equipment as one sentence starting "Equipment:". Empty when there are none. Never write a note about the source, the original recipe or anything the input doesn't say, and do not repeat what the steps or the ingredient lines already say.

Example of steps: [{"text":"Soak the beans.","substeps":[]},{"text":"Prep meat","substeps":["Clean the sink.","Cut the meat.","Store it in a bowl."]},{"text":"Cook for 2 hours.","substeps":[]}]

Example of sections for a soup: [{"heading":"Base","items":["1 onion, diced","2 cloves garlic"]},{"heading":"Beans and lentils","items":["1 cup lentils","½ cup chickpeas"]},{"heading":"Herbs and greens","items":["1 bunch parsley","4oz spinach"]},{"heading":"To finish","items":["½ lemon","Salt to taste"]}]

Write in the language of the input.`

function plainStep(step: string) {
	return step.replace(leadingNumber, '').replace(bullet, '').trim()
}

function plainHeading(heading: string) {
	return heading.replace(/^#+\s*/, '').trim()
}

function ingredientLines(sections: TidyOutput['sections']) {
	return sections.flatMap(({ heading, items }) => {
		const text = heading ? plainHeading(heading) : ''

		const label = /^ingredients?$/i.test(text)
			? ''
			: formatIngredientHeading(text)

		return [label, ...items].flatMap((line) => {
			const text = line.replace(bullet, '').trim()

			return text ? [text] : []
		})
	})
}

export function toTidiedRecipe(output: TidyOutput): TidiedRecipe {
	return {
		title: clampRecipeTitle(output.title),
		ingredients: ingredientLines(output.sections),
		steps: output.steps.flatMap((step) => {
			const text = plainStep(step.text)

			return text
				? [
						text,
						...step.substeps.flatMap((sub) => {
							const subText = plainStep(sub)

							return subText ? [formatSubStep(subText)] : []
						}),
					]
				: []
		}),
		notes: output.notes.trim().slice(0, recipeNotesMax) || undefined,
	}
}

// ===== Guardrails =====

// The digits a recipe leans on. Fraction glyphs split into digits so "1½" and
// "1 1/2" read the same.
function numbers(text: string) {
	return new Set(
		text
			.replaceAll(/([¼-¾⅐-⅞])/g, ' $1')
			.normalize('NFKD')
			.match(/\d+/g),
	)
}

const MIN_INGREDIENTS_KEPT = 0.6

function distinctIngredients(lines: string[]) {
	return new Set(
		lines.flatMap((line) =>
			ingredientHeading(line) === undefined
				? [line.toLowerCase().replaceAll(/\s+/g, ' ').trim()]
				: [],
		),
	)
}

// A model can quietly drop a line or change an amount. Nothing that does gets
// back to the cook.
export function assertFaithful(input: TidyRecipeInput, tidied: TidiedRecipe) {
	const unsafe = new AiTaskError("couldn't tidy that safely — try again")

	if (!tidied.title || (!tidied.ingredients.length && !tidied.steps.length))
		throw new AiTaskError("couldn't find a recipe in that")

	const known = numbers(sourceText(input))

	const written = numbers(
		[tidied.title, ...tidied.ingredients, ...tidied.steps].join('\n'),
	)

	for (const digits of written) if (!known.has(digits)) throw unsafe

	if ('text' in input) return

	const kept = distinctIngredients(tidied.ingredients).size
	const had = distinctIngredients(input.ingredients).size

	if (kept < Math.ceil(had * MIN_INGREDIENTS_KEPT)) throw unsafe

	if (input.steps.length && !tidied.steps.length) throw unsafe
}

// ===== Task =====

export async function tidyRecipe(
	model: LanguageModel,
	input: TidyRecipeInput,
): Promise<TidiedRecipe> {
	const text = sourceText(input)

	if (text.length > tidyInputMax)
		throw new AiTaskError('that recipe is too long')

	const output = await runTask({
		model,
		system,
		input: text,
		schema: tidyOutput,
	})

	const tidied = toTidiedRecipe(output)

	assertFaithful(input, tidied)

	// The model sometimes leaves an equipment list out; the plain sorter reads it
	// reliably, so what it found is kept.
	if ('text' in input) {
		const equipment = parsePastedRecipe(input.text).notes?.split('\n')[0]

		if (
			equipment?.startsWith('Equipment:') &&
			!tidied.notes?.includes(equipment.slice(0, 20))
		)
			tidied.notes = [tidied.notes, equipment].filter(Boolean).join('\n')
	}

	return tidied
}
