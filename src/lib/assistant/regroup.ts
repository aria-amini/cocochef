import { z } from 'zod'

import { normalizeIngredientName } from '@/lib/pantry/catalog'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'

// ===== Contract =====

// The ingredients as written, headings included so the grouping they came with
// is known, and the steps that use them.
export const regroupRequest = z.object({
	ingredients: z.array(z.string().max(500)).max(200),
	steps: z.array(z.string().max(5000)).max(100),
})

export type RegroupRequest = z.infer<typeof regroupRequest>

// One group of the grouping on offer. `lines` point into the request's
// ingredients and `step` into its steps, at the step the group goes into. A
// group with no heading holds what goes in before any named one.
const regroupGroup = z.object({
	heading: z.string().trim().min(1).max(80).nullable(),
	step: z.number().int().min(0),
	lines: z.array(z.number().int().min(0)).min(1),
})

const regroupResponse = z.object({
	groups: z.array(regroupGroup).max(20),
})

export type RegroupGroup = z.infer<typeof regroupGroup>

export type RegroupResponse = z.infer<typeof regroupResponse>

// ===== Mock source =====

// Stands in for the model while the offer takes shape. A line goes with the
// step that names its food, and a step that says what it makes ("for the
// sauce") starts a group; the steps after it join that group until another
// names something. Steps before any name leave their lines ungrouped.

const stageNames: [RegExp, string][] = [
	[/\b(serve|serving|garnish|top with|topped with|scatter)/, 'to serve'],
	[/\bmarina(de|te|ting)/, 'for the marinade'],
	[/\b(dough|knead)/, 'for the dough'],
	[/\bbatter\b/, 'for the batter'],
	[/\b(dressing|vinaigrette)\b/, 'for the dressing'],
	[/\bfilling\b/, 'for the filling'],
	[/\b(frosting|icing)\b/, 'for the frosting'],
	[/\bglaze\b/, 'for the glaze'],
	[/\bsauce\b/, 'for the sauce'],
	[/\btopping\b/, 'for the topping'],
]

// Words that say how a food comes, not which food it is.
const descriptors = new Set([
	'and',
	'black',
	'chopped',
	'cold',
	'cooked',
	'crushed',
	'diced',
	'dried',
	'extra',
	'for',
	'fresh',
	'grated',
	'green',
	'ground',
	'heavy',
	'large',
	'medium',
	'melted',
	'minced',
	'of',
	'plain',
	'red',
	'sliced',
	'small',
	'softened',
	'taste',
	'the',
	'to',
	'unsalted',
	'warm',
	'white',
	'whole',
])

// "Tomatoes" and "tomato" are one word here.
const fold = (word: string) =>
	word.endsWith('oes')
		? word.slice(0, -2)
		: word.endsWith('s') && !word.endsWith('ss')
			? word.slice(0, -1)
			: word

const words = (text: string) =>
	normalizeIngredientName(text)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.split(/[^\p{L}]+/u)
		.filter(Boolean)
		.map(fold)

// The words that name a line's food: "1 onion, diced" is ["onion"].
const foodWords = (line: string) =>
	words(ingredientSubject(line).split(',')[0] ?? '').filter(
		(word) => word.length > 2 && !descriptors.has(word),
	)

const stageName = (step: string) =>
	stageNames.find(([pattern]) => pattern.test(step.toLowerCase()))?.[1]

// The step a line goes into. A food used again later ("garam masala" in the
// marinade and the sauce) goes, the second time it is listed, to the second
// step that names it.
function stepOfLines(lines: string[], steps: string[]) {
	const stepWords = steps.map((step) => new Set(words(step)))
	const seen = new Map<string, number>()

	return lines.map((line) => {
		const food = foodWords(line)
		const key = food.join(' ')
		const times = seen.get(key) ?? 0
		seen.set(key, times + 1)

		const scores = stepWords.map(
			(known) => food.filter((word) => known.has(word)).length,
		)

		const named = scores.flatMap((score, index) => (score ? [index] : []))

		if (!named.length) return undefined

		if (times) return named[Math.min(times, named.length - 1)]

		return scores.indexOf(Math.max(...scores))
	})
}

export function mockRegroup(request: RegroupRequest): RegroupResponse {
	const lines = request.ingredients.flatMap((line, index) =>
		line.trim() && ingredientHeading(line) === undefined
			? [{ line, index }]
			: [],
	)

	const matched = stepOfLines(
		lines.map(({ line }) => line),
		request.steps,
	)

	// A line no step names stays beside the line above it, or below at the top.
	const filled = matched.map((step, at) => {
		if (step !== undefined) return step
		const above = matched.slice(0, at).filter((found) => found !== undefined)

		return (
			above.at(-1) ?? matched.slice(at).find((found) => found !== undefined)
		)
	})

	// The group each step adds to: the latest step that named one, if any.
	const stages: { heading: string | null; step: number }[] = []

	for (const step of request.steps) {
		const name = stageName(step)
		const before = stages.at(-1)

		stages.push(
			name
				? { heading: name, step: stages.length }
				: (before ?? { heading: null, step: 0 }),
		)
	}

	const groups = new Map<string | null, { step: number; lines: number[] }>()

	for (const [at, step] of filled.entries()) {
		const stage = step === undefined ? undefined : stages[step]
		const line = lines[at]

		if (!stage || !line) return { groups: [] }

		const group = groups.get(stage.heading) ?? { step: stage.step, lines: [] }
		group.lines.push(line.index)
		groups.set(stage.heading, group)
	}

	return settled(
		[...groups.entries()].map(([heading, group]) => ({ heading, ...group })),
	)
}

// The groups in the order the editor shows them: lines with no heading first,
// then by the step each goes into. One group is no grouping, and lines alone
// are no better than before.
function settled(groups: RegroupGroup[]): RegroupResponse {
	const ordered = [...groups].sort(
		(a, b) =>
			Number(a.heading !== null) - Number(b.heading !== null) ||
			a.step - b.step,
	)

	return ordered.length > 1 && ordered.some((group) => group.heading)
		? { groups: ordered }
		: { groups: [] }
}

// ===== From the model =====

export const modelRegroup = z.object({
	groups: z.array(
		z.object({
			heading: z.string().nullable(),
			step: z.number().int(),
			lines: z.array(z.number().int()),
		}),
	),
})

// The model's grouping, taken only whole: every ingredient line in exactly one
// group, steps that exist, and one group per heading. Anything else offers no
// grouping, since a half-right one would lose or repeat a line.
export function regroupFromModel(
	request: RegroupRequest,
	answer: z.infer<typeof modelRegroup>,
): RegroupResponse {
	const ingredientLines = new Set(
		request.ingredients.flatMap((line, index) =>
			line.trim() && ingredientHeading(line) === undefined ? [index] : [],
		),
	)

	const placed = new Set<number>()
	const headings = new Set<string | null>()
	const groups: RegroupGroup[] = []

	for (const group of answer.groups) {
		const heading =
			group.heading
				?.trim()
				.replace(/^#+\s*/, '')
				.replace(/:$/, '')
				.trim() || null

		if (
			(heading && heading.length > 80) ||
			headings.has(heading) ||
			group.step < 0 ||
			group.step >= Math.max(request.steps.length, 1) ||
			group.lines.length === 0
		)
			return { groups: [] }

		for (const line of group.lines) {
			if (!ingredientLines.has(line) || placed.has(line)) return { groups: [] }
			placed.add(line)
		}

		headings.add(heading)
		groups.push({ heading, step: group.step, lines: group.lines })
	}

	// Taken whole or not at all, within the twenty groups an offer can hold.
	return placed.size === ingredientLines.size && groups.length <= 20
		? settled(groups)
		: { groups: [] }
}
