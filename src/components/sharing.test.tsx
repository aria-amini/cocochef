import { renderRoute } from '@tests/support/render/route'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'

const api = vi.hoisted(() => ({
	profile: vi.fn(),
	updateProfile: vi.fn(),
	share: vi.fn(),
	updateShare: vi.fn(),
	publicProfile: vi.fn(),
	publicRecipe: vi.fn(),
	unlisted: vi.fn(),
	web: vi.fn(),
}))

vi.mock('@/lib/sharing/server', () => ({
	getMySharingProfile: api.profile,
	updateSharingProfile: api.updateProfile,
	getMyRecipeShare: api.share,
	updateRecipeShare: api.updateShare,
	createWebSharingLink: vi.fn(),
	readPublicProfile: api.publicProfile,
	readPublicRecipe: api.publicRecipe,
	readUnlistedRecipe: api.unlisted,
	readWebRecipe: api.web,
}))

vi.mock('@/lib/recipes/server', () => ({
	listShelf: () => Promise.resolve({ recipes: [], collections: [] }),
	getRecipe: vi.fn(),
	listBooks: () => Promise.resolve([]),
}))

const session = {
	user: {
		id: 'cook-1',
		name: 'Private account name',
		email: 'private@example.com',
	},
	session: { id: 'session-1', token: 'token' },
}

const recipe = {
	id: 'pasta',
	title: 'Weeknight pasta',
	imageUrl: null,
	sourceUrl: null,
	servings: null,
	totalMinutes: null,
	ingredients: ['## sauce', '1 onion'],
	steps: ['Chop the onion'],
	publisher: { handle: 'aria-amini', displayName: 'Aria’s kitchen' },
}

describe('sharing', () => {
	beforeEach(() => {
		vi.resetAllMocks()
		api.profile.mockResolvedValue(null)
		api.publicProfile.mockResolvedValue({
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
			recipes: [{ ...recipe, slug: 'weeknight-pasta' }],
		})
		api.publicRecipe.mockResolvedValue(recipe)
		api.unlisted.mockResolvedValue(recipe)
	})
	test('chooses a handle and explicitly opts into publishing future finished recipes', async () => {
		api.updateProfile.mockResolvedValue({
			userId: 'cook-1',
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
			autoPublish: true,
		})
		const { screen } = await renderRoute({ path: '/profile/sharing', session })
		await screen
			.getByRole('textbox', { name: 'public handle' })
			.fill('aria-amini')
		await screen
			.getByRole('textbox', { name: 'public name' })
			.fill('Aria’s kitchen')
		await expect
			.element(screen.getByRole('checkbox', { name: /automatically publish/ }))
			.not.toBeChecked()
		await screen
			.getByRole('checkbox', { name: /automatically publish/ })
			.click()
		await screen.getByRole('button', { name: 'save sharing settings' }).click()
		await expect
			.poll(() => api.updateProfile.mock.calls[0]?.[0]?.data)
			.toEqual({
				handle: 'aria-amini',
				displayName: 'Aria’s kitchen',
				autoPublish: true,
			})
		await expect
			.element(screen.getByText('saved', { exact: true }))
			.toBeVisible()
	})
	test('public profile is readable without signing in and opens a readable recipe address', async () => {
		const { screen, router } = await renderRoute({
			path: '/aria-amini',
		})

		await expect
			.element(screen.getByRole('heading', { name: 'Aria’s kitchen' }))
			.toBeVisible()
		await screen.getByRole('link', { name: 'Weeknight pasta' }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/aria-amini/weeknight-pasta')
		await expect
			.element(
				screen.getByRole('heading', { name: 'ingredients', exact: true }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('1 onion')).toBeVisible()
		await expect.element(screen.getByText('Chop the onion')).toBeVisible()
		await expect
			.element(screen.getByText('private@example.com'))
			.not.toBeInTheDocument()
	})
	test('opens a shared recipe in the app for someone with a session, so they can cook it', async () => {
		const { router } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
			session,
		})

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/pasta')
	})
	test('unlisted recipe can be read without an account and cannot be opened by its database id', async () => {
		const { screen } = await renderRoute({
			path: '/s/00000000-0000-4000-8000-000000000001',
		})

		await expect
			.element(screen.getByRole('heading', { name: 'Weeknight pasta' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'open in my kitchen' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByText('shared by link.', { exact: false }))
			.toBeVisible()
	})
})
