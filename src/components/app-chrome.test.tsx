import { expectScreenshot } from '@aamini/config/vitest/browser'
import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'
import type { RenderResult } from 'vitest-browser-react'

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	copyRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	// One recipe, since an empty shelf hides the phone's round add button.
	listShelf: () =>
		Promise.resolve({
			recipes: [
				{
					id: 'recipe-1',
					userId: 'user-1',
					visibility: null,
					title: 'dal',
					imageUrl: null,
					sourceUrl: null,
					sourceNotes: null,
					servings: null,
					totalMinutes: null,
					notes: null,
					createdAt: new Date(),
					finalizedAt: new Date(),
					cookCount: 0,
					lastCookedAt: null,
					forkedFromId: null,
					savedAt: new Date(),
				},
			],
		}),
	getRecipe: () => Promise.resolve(null),
	createRecipe: vi.fn(),
	updateRecipe: vi.fn(),
	deleteRecipe: vi.fn(),
}))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: () => Promise.resolve({ warming: false, results: [] }),
	popularRecipes: () => Promise.resolve({ warming: false, results: [] }),
}))

const member = {
	user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' },
	session: { id: 'session-1', token: 'token' },
}

// The page keeps its box but none of its pixels, so the shell is captured
// around an empty page. Pages own their own baselines.
async function emptyPage(screen: RenderResult) {
	const main = screen.getByRole('main')

	await expect.element(main).toBeVisible()
	main.element().style.visibility = 'hidden'
}

// The sidebar on desktop; the header, tab bar and round add button on a phone.
describe('app shell, captured', () => {
	test('on the recipes shelf', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		await expect
			.element(screen.getByRole('link', { name: 'dal' }))
			.toBeInTheDocument()
		await emptyPage(screen)
		await expectScreenshot(screen.container, 'shell')
	})
})
