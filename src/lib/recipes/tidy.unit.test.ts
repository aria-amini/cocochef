import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, test } from 'vite-plus/test'

import { AiTaskError } from '@/lib/ai/run-task'

import { tidyRecipe, type TidyOutput } from './tidy'
import type { TidyRecipeInput } from './tidy-input'

const usage = {
	inputTokens: {
		total: 1,
		noCache: 1,
		cacheRead: undefined,
		cacheWrite: undefined,
	},
	outputTokens: { total: 1, text: 1, reasoning: undefined },
}

function modelAnswering(answer: TidyOutput) {
	return new MockLanguageModelV4({
		doGenerate: async () => ({
			content: [{ type: 'text', text: JSON.stringify(answer) }],
			finishReason: { unified: 'stop', raw: undefined },
			usage,
			warnings: [],
		}),
	})
}

const saved: TidyRecipeInput = {
	title: 'The BEST Pasta Ever!! | Cookblog',
	ingredients: [
		'Ingredients',
		'200 g spaghetti',
		'200 g spaghetti',
		'2 cloves garlic',
		'½ cup parmesan',
		'1 tbsp olive oil',
	],
	steps: [
		'Step 1: Boil the spaghetti in salted water for 10 minutes.',
		'Jump to recipe! Rate this recipe 5 stars.',
		'2. Fry the garlic in the olive oil.',
		'Toss with parmesan.',
	],
	notes: 'Keeps 3 days in the fridge.',
}

const good: TidyOutput = {
	title: 'Garlic pasta',
	sections: [
		{ heading: 'Ingredients', items: ['200 g spaghetti'] },
		{
			heading: 'For the sauce',
			items: ['- 2 cloves garlic', '1 tbsp olive oil'],
		},
		{ heading: '## To finish', items: ['½ cup parmesan'] },
	],
	steps: [
		{
			text: '1. Boil the spaghetti in salted water for 10 minutes.',
			substeps: [],
		},
		{ text: 'Fry the garlic in the olive oil.', substeps: [] },
		{ text: 'Toss with parmesan.', substeps: [] },
	],
	notes: 'Keeps 3 days in the fridge.',
}

describe('tidyRecipe', () => {
	test('turns sections into the editor format and strips numbering', async () => {
		const tidied = await tidyRecipe(modelAnswering(good), saved)

		expect(tidied).toEqual({
			title: 'Garlic pasta',
			ingredients: [
				'200 g spaghetti',
				'## For the sauce',
				'2 cloves garlic',
				'1 tbsp olive oil',
				'## To finish',
				'½ cup parmesan',
			],
			steps: [
				'Boil the spaghetti in salted water for 10 minutes.',
				'Fry the garlic in the olive oil.',
				'Toss with parmesan.',
			],
			notes: 'Keeps 3 days in the fridge.',
		})
	})

	test('writes sub-steps as indented lines under their step', async () => {
		const tidied = await tidyRecipe(
			modelAnswering({
				...good,
				steps: [
					{ text: 'Soak the beans.', substeps: [] },
					{
						text: 'Prep',
						substeps: [
							'1. Boil the spaghetti in salted water for 10 minutes.',
							'- Fry the garlic.',
						],
					},
				],
			}),
			saved,
		)

		expect(tidied.steps).toEqual([
			'Soak the beans.',
			'Prep',
			'- Boil the spaghetti in salted water for 10 minutes.',
			'- Fry the garlic.',
		])
	})

	test('tidies pasted text', async () => {
		const tidied = await tidyRecipe(modelAnswering(good), {
			text: 'Pasta\n200 g spaghetti\n2 cloves garlic\n1 tbsp olive oil\n½ cup parmesan\nBoil the spaghetti in salted water for 10 minutes.\nKeeps 3 days.',
		})

		expect(tidied.ingredients).toContain('200 g spaghetti')
	})

	test('keeps the equipment the model left out', async () => {
		const tidied = await tidyRecipe(modelAnswering({ ...good, notes: '' }), {
			text: `Pasta
Equipment
- [x] Large pot
- [x] Colander

Ingredients
200 g spaghetti
2 cloves garlic
1 tbsp olive oil
½ cup parmesan

Method
1. Boil the spaghetti in salted water for 10 minutes.`,
		})

		expect(tidied.notes).toBe('Equipment: Large pot, Colander')
	})

	test('reads "1½" and "1 1/2" as the same amount', async () => {
		const tidied = await tidyRecipe(
			modelAnswering({
				title: 'Flour',
				sections: [{ heading: null, items: ['1 1/2 cups flour'] }],
				steps: [{ text: 'Sift.', substeps: [] }],
				notes: '',
			}),
			{
				title: 'Flour',
				ingredients: ['1½ cups flour'],
				steps: ['Sift.'],
				notes: null,
			},
		)

		expect(tidied.ingredients).toEqual(['1 1/2 cups flour'])
	})

	test('rejects an amount that was not in the source', async () => {
		const changed = {
			...good,
			sections: [
				{ heading: null, items: ['300 g spaghetti', '2 cloves garlic'] },
			],
		}

		await expect(tidyRecipe(modelAnswering(changed), saved)).rejects.toThrow(
			"couldn't tidy that safely",
		)
	})

	test('rejects a cleanup that drops most ingredients', async () => {
		const dropped = {
			...good,
			sections: [{ heading: null, items: ['200 g spaghetti'] }],
		}

		await expect(tidyRecipe(modelAnswering(dropped), saved)).rejects.toThrow(
			AiTaskError,
		)
	})

	test('retains alternate amounts moved from an ingredient into notes', async () => {
		const input: TidyRecipeInput = {
			title: 'soup',
			ingredients: ['1 cup broth (or 250 ml water)'],
			steps: ['Heat.'],
			notes: null,
		}

		const output: TidyOutput = {
			title: 'soup',
			sections: [{ heading: null, items: ['1 cup broth'] }],
			steps: [{ text: 'Heat.', substeps: [] }],
			notes: 'Broth: or 250 ml water.',
		}

		await expect(
			tidyRecipe(modelAnswering(output), input),
		).resolves.toMatchObject({ notes: 'Broth: or 250 ml water.' })
		await expect(
			tidyRecipe(modelAnswering({ ...output, notes: '' }), input),
		).rejects.toThrow("couldn't tidy that safely")
	})

	test('rejects a cleanup that drops every step', async () => {
		await expect(
			tidyRecipe(modelAnswering({ ...good, steps: [] }), saved),
		).rejects.toThrow("couldn't tidy that safely")
	})

	test('says so when the text holds no recipe', async () => {
		await expect(
			tidyRecipe(
				modelAnswering({ title: '', sections: [], steps: [], notes: '' }),
				{ text: 'what is for dinner' },
			),
		).rejects.toThrow("couldn't find a recipe")
	})

	test('refuses a recipe too long to send', async () => {
		await expect(
			tidyRecipe(modelAnswering(good), {
				...saved,
				steps: ['stir '.repeat(5000)],
			}),
		).rejects.toThrow('too long')
	})
})
