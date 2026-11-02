import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'
import { page } from 'vitest/browser'

vi.mock('@/lib/recipes/server', () => ({
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [], collections: [] }),
	getRecipe: vi.fn(),
	createRecipe: vi.fn(),
	updateRecipe: vi.fn(),
	deleteRecipe: vi.fn(),
	moveRecipe: vi.fn(),
	listBooks: vi.fn(),
	createBook: vi.fn(),
	renameBook: vi.fn(),
	deleteBook: vi.fn(),
}))

// A slow loader: long enough for the progress bar and placeholder to show.
vi.mock('@/lib/pantry/server', () => ({
	listPantry: () =>
		new Promise((resolve) => setTimeout(() => resolve([]), 900)),
	createPantryItems: vi.fn(),
	setPantryItemQuantity: vi.fn(),
	deletePantryItem: vi.fn(),
}))

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('page loading', () => {
	test('shows progress and a placeholder while the next page loads', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes',
			session,
		})

		await expect
			.element(screen.getByRole('heading', { name: 'recipes', exact: true }))
			.toBeInTheDocument()

		void router.navigate({ to: '/ingredients' })

		await expect
			.element(page.getByRole('progressbar', { name: 'loading page' }))
			.toBeInTheDocument()
		await expect.element(page.getByText('loading…')).toBeInTheDocument()
		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await expect
			.element(page.getByRole('progressbar', { name: 'loading page' }))
			.not.toBeInTheDocument()
		await expect.element(page.getByText('loading…')).not.toBeInTheDocument()
	})

	test('stays quiet when the next page loads quickly', async () => {
		const { router, screen } = await renderRoute({
			path: '/ingredients',
			session,
		})

		await expect.element(screen.getByText('nothing here yet')).toBeVisible()
		await router.navigate({ to: '/recipes' })
		await expect
			.element(screen.getByRole('heading', { name: 'recipes', exact: true }))
			.toBeInTheDocument()
		await expect
			.element(page.getByRole('progressbar', { name: 'loading page' }))
			.not.toBeInTheDocument()
	})
})
