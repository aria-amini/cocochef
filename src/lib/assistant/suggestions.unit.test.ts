import { describe, expect, test } from 'vite-plus/test'

import {
	markPantry,
	mockSectionLines,
	mockSectionName,
	mockSuggestions,
	suggestionResponse,
} from './suggestions'

const headings = (sections: ReturnType<typeof mockSuggestions>) =>
	sections.map((section) => section.heading)

const lines = (sections: ReturnType<typeof mockSuggestions>) =>
	sections.flatMap((section) =>
		section.ingredients.map((ingredient) => ingredient.line),
	)

describe('mockSuggestions', () => {
	test('suggests a spice blend and toppings for chili', () => {
		const sections = mockSuggestions({
			title: 'Weeknight Chili',
			ingredients: [],
		})

		expect(headings(sections)).toEqual(['spice blend', 'toppings'])
		expect(suggestionResponse.parse({ sections })).toEqual({ sections })
	})

	test('matches whole words of the name only', () => {
		expect(mockSuggestions({ title: 'Chilled soup', ingredients: [] })).toEqual(
			[],
		)
		expect(
			headings(mockSuggestions({ title: 'chicken tacos', ingredients: [] })),
		).toEqual(['taco seasoning', 'toppings'])
	})

	test('suggests nothing for a short or unknown name', () => {
		expect(mockSuggestions({ title: 'ch', ingredients: [] })).toEqual([])
		expect(mockSuggestions({ title: 'toast', ingredients: [] })).toEqual([])
	})

	test('leaves out foods the cook already wrote, in any spelling', () => {
		const sections = mockSuggestions({
			title: 'chili',
			ingredients: ['1 tsp cumin', '2 tbsp chili powder', 'Sour cream'],
		})

		expect(lines(sections)).not.toContain('2 tsp ground cumin')
		expect(lines(sections)).not.toContain('3 tbsp chili powder')
		expect(lines(sections)).not.toContain('1/2 cup sour cream')
		expect(lines(sections)).toContain('1 tsp smoked paprika')
	})

	test('treats plurals and preparation as the same food', () => {
		const sections = mockSuggestions({
			title: 'curry',
			ingredients: ['2 onions', 'garlic'],
		})

		expect(lines(sections)).not.toContain('1 onion, diced')
		expect(lines(sections)).not.toContain('4 cloves garlic, minced')
		expect(lines(sections)).toContain('1 tbsp grated ginger')
	})

	test('skips a section whose heading is already written', () => {
		const sections = mockSuggestions({
			title: 'chili',
			ingredients: ['## Toppings', 'cilantro'],
		})

		expect(headings(sections)).toEqual(['spice blend'])
	})

	test('drops a section once every food in it is written', () => {
		const sections = mockSuggestions({
			title: 'beef stir fry',
			ingredients: [
				'soy sauce',
				'oyster sauce',
				'sesame oil',
				'cornstarch',
				'sugar',
			],
		})

		expect(sections).toEqual([])
	})
})

describe('markPantry', () => {
	test('marks foods the pantry covers, general to specific', () => {
		const [section] = markPantry(
			mockSuggestions({ title: 'tacos', ingredients: [] }),
			['Cumin', 'garlic', 'salsa'],
		)

		const marked = Object.fromEntries(
			section?.ingredients.map((ingredient) => [
				ingredient.line,
				ingredient.inPantry,
			]) ?? [],
		)

		expect(marked['1 tsp ground cumin']).toBe(true)
		// Fresh garlic in the pantry is not garlic powder.
		expect(marked['1/2 tsp garlic powder']).toBe(false)
		expect(marked['1 tbsp chili powder']).toBe(false)
	})
})

describe('mockSectionLines', () => {
	test("suggests a named section's lines, the dish's own first", () => {
		expect(
			mockSectionLines({
				title: 'Weeknight chili',
				section: 'toppings',
				ingredients: [],
			}),
		).toEqual([
			'1 cup shredded cheddar',
			'1/2 cup sour cream',
			'2 green onions, sliced',
		])
	})

	test('knows common sections whatever the dish, less what is written', () => {
		expect(
			mockSectionLines({
				title: 'grilled fish',
				section: 'for the marinade',
				ingredients: ['plain yogurt'],
			}),
		).toEqual(['1 tbsp lemon juice', '2 cloves garlic, grated', '1 tsp salt'])
	})

	test('suggests nothing for a name it does not know', () => {
		expect(
			mockSectionLines({ title: 'chili', section: 'odds', ingredients: [] }),
		).toEqual([])
	})
})

describe('mockSectionName', () => {
	test('names lines after the known section most of them belong to', () => {
		expect(
			mockSectionName({
				title: 'chili',
				lines: ['2 tsp cumin', '1 tbsp chili powder', '1 tsp oregano'],
			}),
		).toBe('spice blend')
	})

	test('names nothing from one line, or from lines that fit nowhere', () => {
		expect(mockSectionName({ title: 'chili', lines: ['2 tsp cumin'] })).toBe(
			null,
		)
		expect(
			mockSectionName({ title: 'toast', lines: ['bread', 'jam', 'tea'] }),
		).toBe(null)
	})
})
