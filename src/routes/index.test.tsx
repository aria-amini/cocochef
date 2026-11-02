import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'

vi.mock('@/lib/recipes/server', () => ({
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [], collections: [] }),
	getRecipe: () => Promise.resolve(null),
	listBooks: () => Promise.resolve([]),
}))

const guest = {
	user: {
		id: 'guest',
		name: 'guest',
		email: 'g@example.com',
		isAnonymous: true,
	},
	session: { id: 'session-1', token: 'token' },
}

describe('landing page', () => {
	test('pitches the app and offers a guest start or sign in', async () => {
		const { screen } = await renderRoute({ path: '/' })

		await expect
			.element(
				screen.getByRole('heading', {
					level: 1,
					name: /never made up by AI/,
				}),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'start your shelf' }).first())
			.toHaveAttribute('href', '/recipes')
		await expect
			.element(screen.getByRole('link', { name: 'sign in' }))
			.toHaveAttribute('href', '/auth/login')
		await expect
			.element(screen.getByRole('img', { name: 'BBC Good Food' }))
			.toBeVisible()
	})

	test('sends anyone with a shelf straight to it', async () => {
		const { router } = await renderRoute({ path: '/', session: guest })

		await expect.poll(() => router.state.location.pathname).toBe('/recipes')
	})

	test('keeps the pitch visible with the dev preview flag', async () => {
		const { router, screen } = await renderRoute({
			path: '/?preview',
			session: guest,
		})

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toBeVisible()
		expect(router.state.location.pathname).toBe('/')
	})
})
