import { afterEach, describe, expect, test, vi } from 'vite-plus/test'

import {
	forgetRecipe,
	getLastOpenedRecipe,
	rememberRecipe,
} from './last-opened'

afterEach(() => {
	vi.unstubAllGlobals()
	forgetRecipe()
})

describe('the last opened recipe', () => {
	test('keeps the id in memory when storage reads but refuses writes', () => {
		vi.stubGlobal('sessionStorage', {
			getItem: () => null,
			setItem: () => {
				throw new Error('quota')
			},
			removeItem: () => {},
		})

		rememberRecipe('pasta')

		expect(getLastOpenedRecipe()).toBe('pasta')
	})

	test('forgets only the named recipe when one is given', () => {
		rememberRecipe('pasta')

		forgetRecipe('soup')
		expect(getLastOpenedRecipe()).toBe('pasta')

		forgetRecipe('pasta')
		expect(getLastOpenedRecipe()).toBeUndefined()
	})

	test('forgets whatever is remembered when none is named', () => {
		rememberRecipe('pasta')

		forgetRecipe()

		expect(getLastOpenedRecipe()).toBeUndefined()
	})
})
