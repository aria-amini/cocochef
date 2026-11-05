import { getAuthMocks } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	copyRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [] }),
	getRecipe: () => Promise.resolve(null),
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
	test('shows sign-in failures in the dialog and clears them on edit', async () => {
		getAuthMocks().signInEmail.mockRejectedValueOnce(new Error('network error'))
		const { screen } = await renderRoute({ path: '/' })
		await screen.getByRole('button', { name: 'sign in' }).click()
		const dialog = screen.getByRole('dialog', { name: 'sign in' })
		await dialog.getByLabelText('email').fill('cook@example.com')
		await dialog.getByLabelText('password').fill('wrong password')
		await dialog.getByRole('button', { name: 'sign in', exact: true }).click()
		await expect
			.element(dialog.getByRole('alert'))
			.toHaveTextContent("couldn't sign you in — try again")
		await dialog.getByLabelText('password').fill('new password')
		await expect.element(dialog.getByRole('alert')).not.toBeInTheDocument()
	})

	test('opens sign in without leaving the landing page', async () => {
		const { screen } = await renderRoute({ path: '/' })
		await screen.getByRole('button', { name: 'sign in' }).click()
		await expect
			.element(screen.getByRole('dialog', { name: 'sign in' }))
			.toBeVisible()
	})

	test('forgets what was typed when the dialog closes', async () => {
		const { screen } = await renderRoute({ path: '/' })
		await screen.getByRole('button', { name: 'sign in' }).click()
		await screen.getByLabelText('email').fill('cook@example.com')
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('dialog', { name: 'sign in' }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'sign in' }).click()
		await expect.element(screen.getByLabelText('email')).toHaveValue('')
	})

	test('pitches the app and offers a guest start or sign in', async () => {
		const { screen } = await renderRoute({ path: '/' })

		await expect
			.element(
				screen.getByRole('heading', {
					level: 1,
					name: /on one shelf/,
				}),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'start your shelf' }).first())
			.toHaveAttribute('href', '/recipes')
		await expect
			.element(screen.getByRole('button', { name: 'sign in' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('img', { name: 'BBC Good Food' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('img', { name: /coco, a black cat/ }))
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
