import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'

vi.mock('@/lib/shelf/server', () => ({
	getShelfStats: async () => ({ recipes: 2, pantryItems: 3 }),
}))

describe('guest signup', () => {
	test('explains that recipes and ingredients transfer to the new account', async () => {
		const { screen } = await renderRoute({
			path: '/auth/signup',
			session: {
				user: {
					id: 'guest',
					name: 'guest cook',
					email: 'guest@example.com',
					isAnonymous: true,
				},
				session: { id: 'guest-session', token: 'token' },
			},
		})

		await expect
			.element(
				screen.getByText(
					'keep your 2 recipes and 3 ingredients on any device once you have an account.',
				),
			)
			.toBeVisible()
	})
})
