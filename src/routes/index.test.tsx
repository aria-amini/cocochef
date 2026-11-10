import { expectScreenshot } from '@aamini/config/vitest/browser'
import { getAuthMocks } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import { importSites } from '@/lib/import/sites'

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
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
	})

	test('shows the whole pitch at once, with nothing fading in', async () => {
		const { screen } = await renderRoute({ path: '/' })

		const main = screen.getByRole('main')

		await expect.element(main).toBeVisible()

		// Read straight after render: a page that is blank until hydration, or
		// that fades in, would show opacity below 1 or a running animation here.
		for (const node of [
			main.element(),
			...main.element().querySelectorAll('*'),
		])
			expect(getComputedStyle(node).opacity).toBe('1')

		expect(
			document
				.getAnimations()
				.filter((animation) => animation.playState === 'running'),
		).toEqual([])
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		)
	})

	test('lists what you can do, each with its pantry sprite', async () => {
		const { screen } = await renderRoute({ path: '/' })

		const features = screen.getByRole('region', { name: 'What you can do' })
		const items = features.getByRole('listitem')

		await expect.element(items.first()).toBeVisible()
		expect(
			items.elements().map((item) => item.querySelector('h2')?.textContent),
		).toEqual([
			'save from sites you trust',
			'write down your own',
			'keep your place while you cook',
		])

		for (const sprite of features.element().querySelectorAll('img'))
			await expect.poll(() => sprite.naturalWidth).toBeGreaterThan(0)
	})

	test('shows every supported site as a plain row of logos', async () => {
		const { screen } = await renderRoute({ path: '/' })

		const sites = screen.getByRole('region', { name: 'Supported recipe sites' })

		await expect.element(sites).toBeVisible()

		for (const site of importSites) {
			const logo = sites.getByRole('img', { name: site.name })

			await expect.element(logo).toBeVisible()
			await expect
				.poll(() => {
					const image = logo.element()

					return image instanceof HTMLImageElement ? image.naturalWidth : 0
				})
				.toBeGreaterThan(0)
		}

		await expect.element(sites.getByText('& most recipe sites')).toBeVisible()
	})

	test('offers the guest start at the top and again at the end', async () => {
		const { screen } = await renderRoute({ path: '/' })

		const starts = screen.getByRole('link', { name: 'start your shelf' })

		await expect.element(starts.first()).toBeVisible()
		expect(starts.elements().map((link) => link.getAttribute('href'))).toEqual([
			'/recipes',
			'/recipes',
		])
		await expect
			.element(screen.getByRole('heading', { name: 'save your first recipe' }))
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

	test('captures the landing page', async () => {
		const { screen } = await renderRoute({ path: '/' })

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toBeVisible()
		await expectScreenshot(screen.container, 'landing', { fullHeight: true })
	})
})
