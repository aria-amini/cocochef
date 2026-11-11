import { z } from 'zod'

import {
	ingredientHeading,
	ingredientSubject,
	splitIngredientAmount,
} from '@/lib/recipes/ingredient-line'

// ===== Contract =====

// The lines written without an amount, such as "garlic".
export const amountRequest = z.object({
	title: z.string().trim().max(200),
	lines: z.array(z.string().max(500)).max(200),
})

export type AmountRequest = z.infer<typeof amountRequest>

// A likely amount for each line, in order, or null where none fits.
export type AmountResponse = { amounts: (string | null)[] }

// Whether a line could take a suggested amount: a food, written without one,
// that does not say it goes by feel.
export function wantsAmount(line: string) {
	const text = line.trim()

	return (
		Boolean(text) &&
		ingredientHeading(text) === undefined &&
		!splitIngredientAmount(text).amount &&
		!/\b(to taste|as needed|for serving|optional|a pinch|some)\b/i.test(text)
	)
}

// ===== Mock source =====

// Stands in for the model: what a recipe for four usually calls for. The
// first entry whose words all appear in the food wins, so longer names come
// first.
const usual: [string, string][] = [
	['olive oil', '2 tbsp'],
	['soy sauce', '2 tbsp'],
	['lemon juice', '1 tbsp'],
	['garam masala', '2 tsp'],
	['chili powder', '1 tsp'],
	['baking powder', '2 tsp'],
	['heavy cream', '1/2 cup'],
	['chicken thigh', '1 lb'],
	['chicken breast', '1 lb'],
	['garlic', '3 cloves'],
	['onion', '1'],
	['shallot', '1'],
	['ginger', '1 tbsp'],
	['butter', '2 tbsp'],
	['salt', '1 tsp'],
	['pepper', '1/2 tsp'],
	['cumin', '1 tsp'],
	['paprika', '1 tsp'],
	['turmeric', '1 tsp'],
	['oregano', '1 tsp'],
	['cinnamon', '1 tsp'],
	['sugar', '2 tbsp'],
	['flour', '2 cups'],
	['milk', '1 cup'],
	['yogurt', '1 cup'],
	['egg', '2'],
	['rice', '1 cup'],
	['pasta', '200 g'],
	['spaghetti', '200 g'],
	['tomato', '1 can'],
	['carrot', '2'],
	['celery', '2 stalks'],
	['potato', '1 lb'],
	['lemon', '1'],
	['lime', '1'],
	['cilantro', '1 handful'],
	['parsley', '1 handful'],
	['basil', '1 handful'],
	['parmesan', '30 g'],
	['cheddar', '1 cup'],
	['miso', '2 tbsp'],
	['honey', '1 tbsp'],
	['stock', '2 cups'],
	['broth', '2 cups'],
	['chicken', '1 lb'],
	['beef', '1 lb'],
]

const words = (text: string) =>
	text
		.toLowerCase()
		.split(/[^a-z]+/)
		.filter(Boolean)
		.map((word) =>
			word.endsWith('es') && word.length > 4 ? word.slice(0, -2) : word,
		)
		.map((word) =>
			word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word,
		)

export function mockAmounts(request: AmountRequest): AmountResponse {
	return {
		amounts: request.lines.map((line) => {
			if (!wantsAmount(line)) return null
			const food = words(ingredientSubject(line).split(',')[0] ?? '')

			const match = usual.find(([name]) =>
				words(name).every((word) => food.includes(word)),
			)

			return match?.[1] ?? null
		}),
	}
}

// ===== From the model =====

// The model answers by line number, so a skipped or reordered line cannot
// shift an amount onto the wrong food.
export const modelAmounts = z.object({
	amounts: z.array(
		z.object({ line: z.number().int(), amount: z.string().nullable() }),
	),
})

// One amount per requested line, only where the line wants one and the answer
// reads like an amount ("2 tbsp", "3 cloves"), not a sentence.
export function amountsFromModel(
	request: AmountRequest,
	answer: z.infer<typeof modelAmounts>,
): AmountResponse {
	const byLine = new Map(
		answer.amounts.map(({ line, amount }) => [line, amount?.trim()]),
	)

	return {
		amounts: request.lines.map((line, index) => {
			const amount = byLine.get(index)

			return wantsAmount(line) &&
				amount &&
				amount.length <= 24 &&
				/^[\d¼½¾⅓⅔⅛]/.test(amount)
				? amount
				: null
		}),
	}
}
