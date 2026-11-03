import { describe, expect, test } from 'vite-plus/test'

import {
	parseTransferDocument,
	toTransferDocument,
	toTransferRecipe,
	transferFilename,
	transferFormat,
} from './transfer'

const saved = {
	title: 'Ash Resteh',
	sourceUrl: null,
	imageUrl: null,
	notes: null,
	finalizedAt: new Date(),
	ingredients: ['## sauce', '1 onion'],
	ingredientCategories: {},
	steps: ['simmer'],
}

describe('recipe transfer files', () => {
	test('round-trips a recipe through the file format', () => {
		const document = toTransferDocument([
			toTransferRecipe({
				...saved,
				sourceUrl: 'https://example.com/resteh',
				notes: 'less salt',
				ingredientCategories: { '1 onion': 'other' },
				book: 'soups',
			}),
		])

		const parsed = parseTransferDocument(JSON.stringify(document))

		expect(parsed).toEqual({
			ok: true,
			recipes: [
				{
					title: 'Ash Resteh',
					sourceUrl: 'https://example.com/resteh',
					notes: 'less salt',
					finalized: true,
					book: 'soups',
					ingredients: ['## sauce', '1 onion'],
					ingredientCategories: { '1 onion': 'other' },
					steps: ['simmer'],
				},
			],
		})
		expect(document.format).toBe(transferFormat)
	})

	test('preserves an empty publisher-notes marker through a transfer', () => {
		const document = toTransferDocument([
			toTransferRecipe({ ...saved, sourceNotes: '' }),
		])

		expect(parseTransferDocument(JSON.stringify(document))).toMatchObject({
			ok: true,
			recipes: [{ sourceNotes: '' }],
		})
	})

	test('takes any step a cook could write, however long', () => {
		const step = 'stir '.repeat(2000)

		const parsed = parseTransferDocument(
			JSON.stringify(
				toTransferDocument([toTransferRecipe({ ...saved, steps: [step] })]),
			),
		)

		expect(parsed).toMatchObject({ ok: true })
	})

	test('keeps a drafts status and leaves out photos from this kitchen', () => {
		const draft = toTransferRecipe({
			...saved,
			finalizedAt: null,
			imageUrl: 'recipes/user-1-abc',
		})

		expect(draft).toMatchObject({ finalized: false })
		expect(draft).not.toHaveProperty('imageUrl')
		expect(
			toTransferRecipe({ ...saved, imageUrl: 'https://example.com/a.jpg' }),
		).toMatchObject({ imageUrl: 'https://example.com/a.jpg' })
	})

	test('refuses files that are not recipe files or are from a newer version', () => {
		expect(parseTransferDocument('{ "recipes": [] }')).toMatchObject({
			ok: false,
			error: "that isn't a dutch-oven recipe file",
		})
		expect(parseTransferDocument('nope')).toEqual({
			ok: false,
			error: "that file isn't JSON",
		})
		expect(
			parseTransferDocument(
				JSON.stringify({
					format: transferFormat,
					version: 2,
					recipes: [],
				}),
			),
		).toMatchObject({ ok: false, error: expect.stringContaining('newer') })
	})

	test('says which recipe is wrong and takes none of the file', () => {
		const parsed = parseTransferDocument(
			JSON.stringify({
				format: transferFormat,
				version: 1,
				recipes: [{ title: 'fine' }, { title: '   ' }],
			}),
		)

		expect(parsed).toMatchObject({
			ok: false,
			error: expect.stringContaining('recipe 2: title'),
		})
		expect(
			parseTransferDocument(
				JSON.stringify({
					format: transferFormat,
					version: 1,
					recipes: [{ title: 'x', ingredientCategories: { a: 'furniture' } }],
				}),
			),
		).toMatchObject({ ok: false })
	})

	test('tidies hand-edited titles and category keys', () => {
		expect(
			parseTransferDocument(
				JSON.stringify({
					format: transferFormat,
					version: 1,
					recipes: [
						{
							title: ' dal ',
							ingredients: ['1 onion'],
							ingredientCategories: { ' 1 onion ': 'other' },
						},
					],
				}),
			),
		).toMatchObject({
			ok: true,
			recipes: [{ title: 'dal', ingredientCategories: { '1 onion': 'other' } }],
		})
	})

	test('names the file after the recipe', () => {
		expect(transferFilename('Crème fraîche & pasta!')).toBe(
			'creme-fraiche-pasta.json',
		)
		expect(transferFilename()).toBe('dutch-oven-recipes.json')
	})
})
