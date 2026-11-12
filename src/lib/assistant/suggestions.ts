import { z } from 'zod'

import { normalizeIngredientName } from '@/lib/pantry/catalog'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'
import { recipeTitleMax } from '@/lib/recipes/model'

// ===== Contract =====

// What the editor asks about: the recipe's name and the lines written so far,
// headings included, so suggestions can skip what the cook already has.
export const suggestionRequest = z.object({
	title: z.string().trim().max(recipeTitleMax),
	ingredients: z.array(z.string().max(500)).max(200),
})

export type SuggestionRequest = z.infer<typeof suggestionRequest>

const suggestedIngredient = z.object({
	line: z.string().trim().min(1).max(500),
	// The cook's pantry already holds this food.
	inPantry: z.boolean(),
})

// A whole section the cook can take at once ("spice blend"), or line by line.
const suggestedSection = z.object({
	heading: z.string().trim().min(1).max(80),
	ingredients: z.array(suggestedIngredient).min(1).max(20),
})

export const suggestionResponse = z.object({
	sections: z.array(suggestedSection).max(3),
})

export type SuggestedSection = z.infer<typeof suggestedSection>

export type SuggestionResponse = z.infer<typeof suggestionResponse>

// A name this short says nothing about the dish yet.
export const suggestionTitleMin = 3

// ===== Matching foods =====

// The food a line names, as words: "2 tsp ground cumin, toasted" is
// ["ground", "cumin"]. Plurals fold so "onions" meets "onion".
function foodWords(line: string) {
	const subject = ingredientSubject(line).split(',')[0] ?? ''

	return normalizeIngredientName(subject)
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.split(' ')
		.filter(Boolean)
		.map((word) =>
			word.endsWith('oes')
				? word.slice(0, -2)
				: word.endsWith('s') && !word.endsWith('ss')
					? word.slice(0, -1)
					: word,
		)
}

// Words that make a different thing of the food before them: garlic powder is
// not garlic, and chili flakes are not a chili.
const formWords = new Set([
	'powder',
	'flake',
	'paste',
	'sauce',
	'oil',
	'juice',
	'extract',
	'seed',
	'stock',
	'broth',
	'vinegar',
])

// Every word of `general` appears in `specific`, and `specific` names no other
// form of it: "cumin" covers "ground cumin", but "garlic" does not cover
// "garlic powder".
function covers(general: string[], specific: string[]) {
	return (
		general.length > 0 &&
		general.every((word) => specific.includes(word)) &&
		specific.every((word) => !formWords.has(word) || general.includes(word))
	)
}

// A suggestion the cook already wrote, in either spelling's direction.
function alreadyWritten(line: string, written: string[][]) {
	const words = foodWords(line)

	return written.some(
		(existing) => covers(existing, words) || covers(words, existing),
	)
}

// The foods the cook has written, as words, headings left out.
function writtenFoods(ingredients: string[]) {
	return ingredients.flatMap((line) => {
		if (!line.trim() || ingredientHeading(line) !== undefined) return []

		const words = foodWords(line)

		return words.length ? [words] : []
	})
}

// The section names the cook has written, normalized.
function writtenHeadings(ingredients: string[]) {
	return new Set(
		ingredients.flatMap((line) => {
			const heading = ingredientHeading(line)

			return heading ? [normalizeIngredientName(heading)] : []
		}),
	)
}

// Marks each suggested food the pantry holds. A pantry item is the general
// food, so "cumin" in the pantry covers a suggested "ground cumin".
export function markPantry(
	sections: SuggestedSection[],
	pantryNames: string[],
): SuggestedSection[] {
	const pantry = pantryNames.map(foodWords)

	return sections.map((section) => ({
		...section,
		ingredients: section.ingredients.map((ingredient) => {
			const words = foodWords(ingredient.line)

			return {
				...ingredient,
				inPantry: pantry.some((item) => covers(item, words)),
			}
		}),
	}))
}

// ===== Mock source =====

// Stands in for the model while the editor's suggestions take shape: a few
// dishes with the boilerplate cooks reach for. Matched on whole words of the
// recipe's name.
const mockDishes: { words: string[]; sections: [string, string[]][] }[] = [
	{
		words: ['chili', 'chilli'],
		sections: [
			[
				'spice blend',
				[
					'3 tbsp chili powder',
					'2 tsp ground cumin',
					'1 tsp smoked paprika',
					'1 tsp dried oregano',
					'1/2 tsp cayenne pepper',
					'1 tsp kosher salt',
				],
			],
			[
				'toppings',
				[
					'1 cup shredded cheddar',
					'1/2 cup sour cream',
					'2 green onions, sliced',
				],
			],
		],
	},
	{
		words: ['curry'],
		sections: [
			[
				'spice blend',
				[
					'2 tsp garam masala',
					'1 tsp ground turmeric',
					'1 tsp ground cumin',
					'1 tsp ground coriander',
					'1/2 tsp chili flakes',
				],
			],
			[
				'aromatics',
				['1 onion, diced', '4 cloves garlic, minced', '1 tbsp grated ginger'],
			],
		],
	},
	{
		words: ['taco', 'tacos'],
		sections: [
			[
				'taco seasoning',
				[
					'1 tbsp chili powder',
					'1 tsp ground cumin',
					'1/2 tsp garlic powder',
					'1/2 tsp onion powder',
					'1/2 tsp smoked paprika',
				],
			],
			[
				'toppings',
				[
					'1/2 cup salsa',
					'1/4 cup chopped cilantro',
					'1 lime, cut into wedges',
				],
			],
		],
	},
	{
		words: ['pancake', 'pancakes'],
		sections: [
			[
				'dry',
				[
					'1 1/2 cups flour',
					'1 tbsp sugar',
					'2 tsp baking powder',
					'1/2 tsp salt',
				],
			],
			['wet', ['1 1/4 cups milk', '1 egg', '3 tbsp melted butter']],
		],
	},
	{
		words: ['stir', 'stirfry', 'stir-fry'],
		sections: [
			[
				'sauce',
				[
					'3 tbsp soy sauce',
					'1 tbsp oyster sauce',
					'1 tsp sesame oil',
					'1 tsp cornstarch',
					'1 tsp sugar',
				],
			],
		],
	},
	{
		words: ['bolognese', 'ragu'],
		sections: [
			[
				'soffritto',
				['1 onion, diced', '1 carrot, diced', '1 celery stalk, diced'],
			],
			[
				'seasoning',
				['2 bay leaves', '1 tsp dried oregano', '1/2 cup red wine'],
			],
		],
	},
]

// Canned sections for the dish the name mentions, less what is already written.
export function mockSuggestions(
	request: SuggestionRequest,
): SuggestedSection[] {
	if (request.title.length < suggestionTitleMin) return []

	const titleWords = normalizeIngredientName(request.title)
		.split(/[^\p{L}\p{N}-]+/u)
		.filter(Boolean)

	const dish = mockDishes.find((entry) =>
		entry.words.some((word) => titleWords.includes(word)),
	)

	if (!dish) return []

	const headings = writtenHeadings(request.ingredients)

	const written = writtenFoods(request.ingredients)

	return dish.sections.flatMap(([heading, lines]) => {
		if (headings.has(heading)) return []

		const ingredients = lines
			.filter((line) => !alreadyWritten(line, written))
			.map((line) => ({ line, inPantry: false }))

		return ingredients.length ? [{ heading, ingredients }] : []
	})
}

// ===== Lines for one section =====

// A section the cook has just named ("spice blend"), and what is written so
// far, so its lines can be suggested inside it.
export const sectionLinesRequest = z.object({
	title: z.string().trim().max(recipeTitleMax),
	section: z.string().trim().min(1).max(80),
	ingredients: z.array(z.string().max(500)).max(200),
})

export type SectionLinesRequest = z.infer<typeof sectionLinesRequest>

// Sections cooks name whatever the dish, for when the dish says nothing.
const commonSections: [string, string[]][] = [
	[
		'marinade',
		[
			'1 cup plain yogurt',
			'1 tbsp lemon juice',
			'2 cloves garlic, grated',
			'1 tsp salt',
		],
	],
	[
		'dressing',
		[
			'3 tbsp olive oil',
			'1 tbsp red wine vinegar',
			'1 tsp dijon mustard',
			'1 pinch salt',
		],
	],
	['garnish', ['1 handful parsley, chopped', '1 lemon, cut into wedges']],
]

const sectionWords = (name: string) =>
	normalizeIngredientName(name)
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 2 && word !== 'for' && word !== 'the')
		.map((word) => (word.endsWith('s') ? word.slice(0, -1) : word))

// Canned lines for a section of that name: the recipe's own dish first, then
// any dish, then the common ones, less what is already written.
export function mockSectionLines(request: SectionLinesRequest): string[] {
	const wanted = sectionWords(request.section)

	if (!wanted.length) return []

	const titleWords = normalizeIngredientName(request.title)
		.split(/[^\p{L}\p{N}-]+/u)
		.filter(Boolean)

	const dishFirst = [...mockDishes].sort(
		(a, b) =>
			Number(b.words.some((word) => titleWords.includes(word))) -
			Number(a.words.some((word) => titleWords.includes(word))),
	)

	const sections = [
		...dishFirst.flatMap((dish) => dish.sections),
		...commonSections,
	]

	const found = sections.find(([heading]) => {
		const words = sectionWords(heading)

		return wanted.every((word) => words.includes(word))
	})

	if (!found) return []

	const written = writtenFoods(request.ingredients)

	return found[1].filter((line) => !alreadyWritten(line, written))
}

// ===== A name for a section =====

// The lines of a section with no name yet, to name it from.
export const sectionNameRequest = z.object({
	title: z.string().trim().max(recipeTitleMax),
	lines: z.array(z.string().max(500)).min(1).max(100),
})

export type SectionNameRequest = z.infer<typeof sectionNameRequest>

// The known section most of these lines belong to, the recipe's own dish
// first; nothing unless at least two of them, and most of them, fit.
export function mockSectionName(request: SectionNameRequest): string | null {
	const written = writtenFoods(request.lines)

	if (written.length < 2) return null

	const titleWords = normalizeIngredientName(request.title)
		.split(/[^\p{L}\p{N}-]+/u)
		.filter(Boolean)

	const sections = [
		...[...mockDishes]
			.sort(
				(a, b) =>
					Number(b.words.some((word) => titleWords.includes(word))) -
					Number(a.words.some((word) => titleWords.includes(word))),
			)
			.flatMap((dish) => dish.sections),
		...commonSections,
	]

	let best: { heading: string; fits: number } | undefined

	for (const [heading, lines] of sections) {
		const known = lines.map(foodWords)

		const fits = written.filter((words) =>
			known.some((other) => covers(other, words) || covers(words, other)),
		).length

		if (fits > (best?.fits ?? 0)) best = { heading, fits }
	}

	return best && best.fits >= 2 && best.fits * 2 > written.length
		? best.heading
		: null
}

// ===== From the model =====

// What the model is asked to answer. Kept loose so any model can follow it;
// the editor's contracts above are filled in from it, never trusted as is.
export const modelSections = z.object({
	sections: z.array(
		z.object({ heading: z.string(), lines: z.array(z.string()) }),
	),
})

export const modelLines = z.object({ lines: z.array(z.string()) })

export const modelSectionName = z.object({ name: z.string().nullable() })

// A section name as the editor writes it: no `## ` and no trailing colon.
function cleanHeading(text: string) {
	const heading = text
		.trim()
		.replace(/^#+\s*/, '')
		.replace(/:$/, '')
		.trim()

	return heading && heading.length <= 80 ? heading : undefined
}

// Ingredient lines, one food each, without list markers or repeats.
function cleanLines(lines: string[]) {
	const seen = new Set<string>()

	return lines.flatMap((text) => {
		const line = text
			.trim()
			.replace(/^[-*•]\s+/, '')
			.trim()

		const key = line.toLowerCase()

		if (
			!line ||
			line.length > 500 ||
			ingredientHeading(line) !== undefined ||
			seen.has(key)
		)
			return []

		seen.add(key)

		return [line]
	})
}

// The model's sections, less the sections and foods the cook already wrote.
export function sectionsFromModel(
	request: SuggestionRequest,
	answer: z.infer<typeof modelSections>,
): SuggestedSection[] {
	const headings = writtenHeadings(request.ingredients)
	const written = writtenFoods(request.ingredients)

	return answer.sections
		.flatMap(({ heading, lines }) => {
			const name = cleanHeading(heading)

			if (!name || headings.has(normalizeIngredientName(name))) return []

			headings.add(normalizeIngredientName(name))

			const ingredients = cleanLines(lines)
				.filter((line) => !alreadyWritten(line, written))
				.slice(0, 20)
				.map((line) => ({ line, inPantry: false }))

			return ingredients.length ? [{ heading: name, ingredients }] : []
		})
		.slice(0, 3)
}

// The model's lines for a section, less the foods the cook already wrote.
export function sectionLinesFromModel(
	request: SectionLinesRequest,
	answer: z.infer<typeof modelLines>,
) {
	const written = writtenFoods(request.ingredients)

	return cleanLines(answer.lines)
		.filter((line) => !alreadyWritten(line, written))
		.slice(0, 20)
}

export function sectionNameFromModel(answer: z.infer<typeof modelSectionName>) {
	return (answer.name ? cleanHeading(answer.name) : undefined) || null
}
