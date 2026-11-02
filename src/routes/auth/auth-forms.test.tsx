import { getAuthMocks } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'

const authMocks = getAuthMocks()

describe('auth forms', () => {
	test('signs in from the submit button', async () => {
		const { screen } = await renderRoute({ path: '/auth/login' })

		await screen.getByPlaceholder('you@example.com').fill('cook@example.com')
		await screen.getByPlaceholder('Password').fill('correct horse')
		await screen.getByRole('button', { name: 'Sign in', exact: true }).click()

		await vi.waitFor(() => {
			expect(authMocks.signInEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					email: 'cook@example.com',
					password: 'correct horse',
				}),
			)
		})
	})

	test('ignores a second sign-in click while the first is pending', async () => {
		let settle: (value: { error: null }) => void = () => {}

		authMocks.signInEmail.mockClear()
		authMocks.signInEmail.mockImplementationOnce(
			() => new Promise((resolve) => (settle = resolve)),
		)

		const { screen } = await renderRoute({ path: '/auth/login' })

		await screen.getByPlaceholder('you@example.com').fill('cook@example.com')
		await screen.getByPlaceholder('Password').fill('correct horse')
		await screen.getByRole('button', { name: 'Sign in', exact: true }).click()

		const pending = screen.getByRole('button', { name: 'Signing in…' })
		await expect.element(pending).toBeDisabled()
		await pending.click({ force: true })

		expect(authMocks.signInEmail).toHaveBeenCalledTimes(1)
		settle({ error: null })
	})

	test('sends Google sign-in back to the page that asked for it', async () => {
		authMocks.signInSocial.mockClear()

		const { screen } = await renderRoute({
			path: '/auth/login?redirect=%2Frecipes%2Fnew',
		})

		await screen.getByRole('button', { name: 'Continue with Google' }).click()

		await vi.waitFor(() => {
			expect(authMocks.signInSocial).toHaveBeenCalledWith({
				provider: 'google',
				callbackURL: `${window.location.origin}/recipes/new`,
			})
		})
	})

	test('sends Google sign-in to the recipes by default', async () => {
		authMocks.signInSocial.mockClear()

		const { screen } = await renderRoute({ path: '/auth/login' })

		await screen.getByRole('button', { name: 'Continue with Google' }).click()

		await vi.waitFor(() => {
			expect(authMocks.signInSocial).toHaveBeenCalledWith({
				provider: 'google',
				callbackURL: `${window.location.origin}/recipes`,
			})
		})
	})

	test('signs up from the submit button', async () => {
		const { screen } = await renderRoute({ path: '/auth/signup' })

		await screen.getByPlaceholder('Name').fill('Cook')
		await screen.getByPlaceholder('Email').fill('cook@example.com')
		await screen.getByPlaceholder('Password').fill('correct horse')
		await screen.getByRole('button', { name: 'Sign up', exact: true }).click()

		await vi.waitFor(() => {
			expect(authMocks.signUpEmail).toHaveBeenCalledWith({
				name: 'Cook',
				email: 'cook@example.com',
				password: 'correct horse',
			})
		})
	})
})
