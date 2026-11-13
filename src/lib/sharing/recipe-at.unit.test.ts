import { describe, expect, test } from 'vite-plus/test'

import { recipeAt } from './recipe-at'

const published = { id: 'pasta', title: 'pasta' }

const full = { id: 'pasta', title: 'pasta', notes: 'mine' }

const read = (
	overrides: Partial<
		Parameters<typeof recipeAt<typeof published, typeof full>>[0]
	>,
) =>
	recipeAt({
		published,
		signedIn: false,
		ownedId: async () => null,
		full: async () => full,
		...overrides,
	})

describe('what a readable address shows', () => {
	test('a visitor gets the plain page', async () => {
		expect(await read({})).toEqual({ kind: 'public', recipe: published })
	})

	test('someone signed in gets the recipe in the app', async () => {
		expect(await read({ signedIn: true })).toEqual({
			kind: 'app',
			recipe: full,
		})
	})

	test('someone signed in who cannot open it in the app still gets the page', async () => {
		expect(await read({ signedIn: true, full: async () => null })).toEqual({
			kind: 'public',
			recipe: published,
		})
	})

	test('a cook opens their own unpublished recipe at its address', async () => {
		expect(
			await read({
				published: null,
				signedIn: true,
				ownedId: async () => 'pasta',
			}),
		).toEqual({ kind: 'app', recipe: full })
	})

	test('a missing or private recipe shows nothing, signed in or not', async () => {
		expect(await read({ published: null })).toBeNull()
		expect(await read({ published: null, signedIn: true })).toBeNull()
	})
})
