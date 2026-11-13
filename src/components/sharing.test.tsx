import { getAuthMocks, setMockSession } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page } from 'vitest/browser'

const api = vi.hoisted(() => ({
	profile: vi.fn(),
	updateProfile: vi.fn(),
	share: vi.fn(),
	updateShare: vi.fn(),
	publicProfile: vi.fn(),
	publicRecipe: vi.fn(),
	unlisted: vi.fn(),
	web: vi.fn(),
	getRecipe: vi.fn(),
	deleteRecipe: vi.fn(),
}))

vi.mock('@/lib/sharing/server', () => ({
	readOwnedRecipeAddress: () => Promise.resolve(null),
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

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/recipes/server')>()),
	listShelf: () => Promise.resolve({ recipes: [] }),
	getRecipe: api.getRecipe,
	deleteRecipe: api.deleteRecipe,
	removeSavedRecipe: api.deleteRecipe,
}))

vi.mock('@/lib/s3', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/s3')>()),
	getAvatarUrl: async () => undefined,
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
	sourceNotes: 'Publisher cooking tip',
	servings: null,
	totalMinutes: null,
	prepMinutes: null,
	ratingValue: null,
	ratingCount: null,
	commentCount: null,
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
		const { screen } = await renderRoute({ path: '/settings', session })
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
		await screen.getByRole('button', { name: 'save settings' }).click()
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
	test('offers the public profile link only once it has a public recipe', async () => {
		const mine = {
			userId: 'cook-1',
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
			autoPublish: false,
		}

		api.profile.mockResolvedValue({ ...mine, isPublic: false })
		const first = await renderRoute({ path: '/settings', session })

		await expect
			.element(
				first.screen.getByText('your profile goes public once you publish', {
					exact: false,
				}),
			)
			.toBeVisible()
		await expect
			.element(first.screen.getByRole('link', { name: 'view public profile' }))
			.not.toBeInTheDocument()
		await first.screen.unmount()

		api.profile.mockResolvedValue({ ...mine, isPublic: true })
		const second = await renderRoute({ path: '/settings', session })

		await expect
			.element(second.screen.getByRole('link', { name: 'view public profile' }))
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
		// The recipe page loads on first visit here, which can be slow when cold.
		await expect
			.element(
				screen.getByRole('heading', { name: 'ingredients', exact: true }),
				{ timeout: 10_000 },
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'edit', exact: true }))
			.toBeVisible()
		await expect.element(screen.getByText('1 onion')).toBeVisible()
		await expect.element(screen.getByText('Chop the onion')).toBeVisible()
		await expect
			.element(screen.getByText('Publisher cooking tip'))
			.toBeVisible()
		await expect
			.element(screen.getByText('private@example.com'))
			.not.toBeInTheDocument()
	})
	test('shows original authorship on a public copy', async () => {
		api.publicRecipe.mockResolvedValue({
			...recipe,
			originalAuthorName: 'Original cook',
		})

		const { screen } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
		})

		await expect
			.element(screen.getByText('copied from Original cook'))
			.toBeVisible()
	})

	test('does not offer unsave when the signed-in viewer owns the public recipe', async () => {
		api.web.mockResolvedValue(recipe)
		api.getRecipe.mockResolvedValue({
			...recipe,
			owned: true,
			saved: true,
			visibility: 'public',
		})

		const { screen } = await renderRoute({
			path: '/sites/example.com/pasta',
		})

		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		getAuthMocks().signUpEmail.mockImplementationOnce(async () => {
			setMockSession(session)

			return { error: null }
		})
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		const signup = screen.getByRole('dialog', { name: 'create an account' })
		await signup.getByLabelText('name').fill('Cook')
		await signup.getByLabelText('email').fill('cook@example.com')
		await signup.getByLabelText('password').fill('password123')
		await signup
			.getByRole('button', { name: 'create account', exact: true })
			.click()
		await expect
			.element(screen.getByRole('link', { name: 'open your recipe' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'saved', exact: true }))
			.not.toBeInTheDocument()
		expect(api.deleteRecipe).not.toHaveBeenCalled()
	})

	test('lights up the recipes tab and leads with a way back on a site recipe', async () => {
		api.web.mockResolvedValue(recipe)

		const { screen } = await renderRoute({
			path: '/sites/example.com/pasta',
			session,
		})

		await expect
			.element(
				screen
					.getByRole('navigation', { name: 'Primary' })
					.getByRole('link', { name: 'recipes' }),
			)
			.toHaveAttribute('aria-current', 'page')
		await expect
			.element(
				screen
					.getByRole('main')
					.getByRole('link', { name: /Aria’s kitchen's recipes/ }),
			)
			.toBeVisible()
	})

	test('remembers a site recipe for the recipes tab, but not an unlisted one', async () => {
		const remembered = () => sessionStorage.getItem('cocochef:last-recipe')

		sessionStorage.clear()
		api.web.mockResolvedValue(recipe)

		const site = await renderRoute({
			path: '/sites/example.com/pasta',
			session,
		})

		await expect
			.element(site.screen.getByRole('heading', { name: 'Weeknight pasta' }))
			.toBeVisible()
		expect(remembered()).toBe('pasta')
		await site.screen.unmount()

		sessionStorage.clear()

		const unlisted = await renderRoute({
			path: '/s/00000000-0000-4000-8000-000000000001',
		})

		await expect
			.element(
				unlisted.screen.getByRole('heading', { name: 'Weeknight pasta' }),
			)
			.toBeVisible()
		expect(remembered()).toBeNull()
	})

	test('keeps the remembered recipe when a published address is unavailable', async () => {
		api.web.mockResolvedValue(recipe)
		api.publicRecipe.mockResolvedValue(null)

		const { screen, router } = await renderRoute({
			path: '/sites/example.com/pasta',
			session,
		})

		await expect
			.element(screen.getByRole('heading', { name: 'Weeknight pasta' }))
			.toBeVisible()
		expect(sessionStorage.getItem('cocochef:last-recipe')).toBe('pasta')

		await router.navigate({
			to: '/$handle/$slug',
			params: { handle: 'aria-amini', slug: 'gone' },
		})
		await expect
			.element(
				screen.getByRole('heading', { name: 'you can’t open this recipe' }),
			)
			.toBeVisible()
		// A link with no recipe behind it is no reason to forget this one.
		expect(sessionStorage.getItem('cocochef:last-recipe')).toBe('pasta')
	})

	test('lets a signed-out visitor open signup from save', async () => {
		api.web.mockResolvedValue(recipe)

		const { screen } = await renderRoute({
			path: '/sites/example.com/pasta',
		})

		const save = screen.getByRole('button', { name: 'save', exact: true })
		await expect.element(save).toBeEnabled()
		await save.click()
		await expect
			.element(screen.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
	})

	test('shows a private or unavailable recipe without exposing its contents', async () => {
		api.publicRecipe.mockResolvedValue(null)
		const { screen } = await renderRoute({ path: '/aria-amini/private-recipe' })
		await expect
			.element(
				screen.getByRole('heading', { name: 'you can’t open this recipe' }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('1 onion')).not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('link', { name: 'back to recipes' }))
			.toBeVisible()
	})
	test('opens a shared recipe in the app for someone with a session, at the same readable address', async () => {
		api.getRecipe.mockResolvedValue({
			...recipe,
			userId: 'someone',
			finalizedAt: new Date(),
			owned: false,
			saved: false,
			publicPath: '/aria-amini/weeknight-pasta',
			ingredientCategories: {},
		})

		const { screen, router } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
			session,
		})

		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		expect(router.state.location.pathname).toBe('/aria-amini/weeknight-pasta')
	})
	test('keeps the owner at the readable address when made private', async () => {
		const mine = {
			...recipe,
			userId: 'cook-1',
			finalizedAt: new Date(),
			owned: true,
			saved: true,
			ingredientCategories: {},
		}

		api.getRecipe
			.mockResolvedValueOnce({
				...mine,
				publicPath: '/aria-amini/weeknight-pasta',
			})
			.mockResolvedValue({ ...mine, publicPath: null })
		api.profile.mockResolvedValue({
			userId: 'cook-1',
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
			autoPublish: false,
		})
		api.share.mockResolvedValue({
			visibility: 'public',
			slug: 'weeknight-pasta',
			token: 'token',
		})
		api.updateShare.mockResolvedValue({
			visibility: 'private',
			slug: 'weeknight-pasta',
			token: 'token',
		})

		const { screen, router } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
			session,
		})

		await screen.getByRole('button', { name: /share/ }).click()
		await screen.getByRole('radio', { name: 'private' }).click()

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/aria-amini/weeknight-pasta')
	})
	test('stays at the readable address after taking a saved recipe off the shelf', async () => {
		const saved = {
			...recipe,
			userId: null,
			finalizedAt: new Date(),
			owned: false,
			saved: true,
			ingredientCategories: {},
		}

		let removed = false

		api.getRecipe.mockImplementation(async () => ({
			...saved,
			saved: !removed,
			publicPath: removed ? null : '/aria-amini/weeknight-pasta',
		}))
		api.deleteRecipe.mockImplementation(async () => {
			removed = true

			return { id: 'pasta' }
		})

		const { screen, router } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
			session,
		})

		await screen.getByRole('button', { name: 'saved', exact: true }).click()
		await page.getByRole('button', { name: 'remove', exact: true }).click()

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/aria-amini/weeknight-pasta')
		expect(api.deleteRecipe).toHaveBeenCalledWith({ data: { id: 'pasta' } })
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
