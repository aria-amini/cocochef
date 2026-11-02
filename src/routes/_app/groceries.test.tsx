import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test } from 'vite-plus/test'

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('groceries', () => {
	test('says it is a work in progress and what it will do', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })

		await expect
			.element(screen.getByRole('heading', { name: 'groceries', level: 1 }))
			.toBeVisible()
		await expect.element(screen.getByText('work in progress')).toBeVisible()
		await expect
			.element(screen.getByText('pick recipes, get one list'))
			.toBeVisible()
		await expect
			.element(screen.getByText('skips what you already have'))
			.toBeVisible()
	})

	test('links its navigation to a WIP page', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })

		await expect
			.element(
				screen
					.getByRole('navigation', { name: 'Primary' })
					.getByRole('link', { name: 'groceries' }),
			)
			.toHaveAttribute('href', '/coming-soon/groceries')
	})

	test('links back to recipes', async () => {
		const { screen } = await renderRoute({ path: '/groceries', session })

		await expect
			.element(
				screen.getByRole('main').getByRole('link', { name: 'back to recipes' }),
			)
			.toHaveAttribute('href', '/recipes')
	})
})
