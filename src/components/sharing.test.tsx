import { getAuthMocks, setMockSession } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

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
	saveRecipe: vi.fn(),
}))

vi.mock('@/lib/sharing/server', async () => {
	const { recipeAt } = await import('@/lib/sharing/recipe-at')
	const { getCurrentSession } = await import('@/lib/auth/session')

	return {
		// The server's choice, made from this file's mocks.
		readRecipeAt: async ({
			data,
		}: {
			data: { handle: string; slug: string }
		}) =>
			recipeAt({
				published: await api.publicRecipe({ data }),
				signedIn: Boolean(await getCurrentSession()),
				ownedId: async () => null,
				full: async (id) => (await api.getRecipe({ data: { id } })) ?? null,
			}),
		getMySharingProfile: api.profile,
		updateSharingProfile: api.updateProfile,
		getMyRecipeShare: api.share,
		updateRecipeShare: api.updateShare,
		createWebSharingLink: vi.fn(),
		readPublicProfile: api.publicProfile,
		readUnlistedRecipe: api.unlisted,
		readWebRecipe: api.web,
	}
})

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/recipes/server')>()),
	listShelf: () =>
		Promise.resolve({ recipes: [], signedIn: true, inProgress: [] }),
	// A query's data can't be undefined; an unset recipe is none.
	getRecipe: async (args: { data: { id: string } }) =>
		(await api.getRecipe(args)) ?? null,
	deleteRecipe: api.deleteRecipe,
	deleteRecipes: () => Promise.resolve({ removed: 0 }),
	removeSavedRecipe: api.deleteRecipe,
	saveRecipe: api.saveRecipe,
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
	test('sets up a public page with a handle and a name, and nothing publishes by default', async () => {
		api.updateProfile.mockResolvedValue({
			userId: 'cook-1',
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
		})
		const { screen } = await renderRoute({ path: '/settings', session })
		const link = screen.getByRole('textbox', { name: 'your link' })

		await link.fill('aria-amini')
		await screen
			.getByRole('textbox', { name: 'name on your page' })
			.fill('Aria’s kitchen')
		// The whole address reads as it is typed.
		await expect.element(screen.getByText(/\/aria-amini$/)).toBeVisible()
		await screen.getByRole('button', { name: 'set up my page' }).click()
		await expect
			.poll(() => api.updateProfile.mock.calls[0]?.[0]?.data)
			.toEqual({ handle: 'aria-amini', displayName: 'Aria’s kitchen' })
		await expect
			.element(screen.getByText('profile saved', { exact: true }))
			.toBeVisible()
	})
	test('offers the public page link only once it has a public recipe', async () => {
		const mine = {
			userId: 'cook-1',
			handle: 'aria-amini',
			displayName: 'Aria’s kitchen',
		}

		api.profile.mockResolvedValue({ ...mine, isPublic: false })
		const first = await renderRoute({ path: '/settings', session })

		await expect
			.element(
				first.screen.getByText('your page goes live once you publish', {
					exact: false,
				}),
			)
			.toBeVisible()
		await expect
			.element(first.screen.getByRole('link', { name: 'view your page' }))
			.not.toBeInTheDocument()
		await first.screen.unmount()

		api.profile.mockResolvedValue({ ...mine, isPublic: true })
		const second = await renderRoute({ path: '/settings', session })

		await expect
			.element(second.screen.getByRole('link', { name: 'view your page' }))
			.toBeVisible()
		await expect
			.element(second.screen.getByRole('button', { name: 'copy link' }))
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
			.element(screen.getByRole('button', { name: /^save / }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'recipe options' }))
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
			.element(screen.getByRole('button', { name: /^save / }))
			.toBeVisible()
		getAuthMocks().signUpEmail.mockImplementationOnce(async () => {
			setMockSession(session)

			return { error: null }
		})
		await screen.getByRole('button', { name: /^save / }).click()
		const signup = screen.getByRole('dialog', { name: 'create an account' })
		await signup.getByLabelText('name').fill('Cook')
		await signup.getByLabelText('email').fill('cook@example.com')
		await signup.getByLabelText('password').fill('password123')
		await signup
			.getByRole('button', { name: 'create account', exact: true })
			.click()
		await screen.getByRole('button', { name: 'recipe options' }).click()
		await expect
			.element(page.getByRole('menuitem', { name: 'open your recipe' }))
			.toBeVisible()
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('button', { name: /^unsave / }))
			.not.toBeInTheDocument()
		expect(api.deleteRecipe).not.toHaveBeenCalled()
	})

	test('lights the tab a site recipe was opened from, and leads with a way back', async () => {
		api.web.mockResolvedValue(recipe)

		const { screen, router } = await renderRoute({
			path: '/sites/example.com/pasta',
			session,
		})

		const tab = (name: string) =>
			screen
				.getByRole('navigation', { name: 'Primary' })
				.getByRole('link', { name })

		// Reached straight from a link, a recipe from the web is home's: that
		// is where recipes are found.
		await expect.element(tab('home')).toHaveAttribute('aria-current', 'page')
		await expect.element(tab('my recipes')).not.toHaveAttribute('aria-current')

		// Opened off the shelf, the same address lights my recipes.
		await router.navigate({ to: '/recipes' })
		await expect
			.element(tab('my recipes'))
			.toHaveAttribute('aria-current', 'page')
		await router.navigate({
			to: '/sites/$site/$slug',
			params: { site: 'example.com', slug: 'pasta' },
		})
		await expect
			.element(screen.getByRole('main').getByText(recipe.title).first())
			.toBeVisible()
		await expect
			.element(tab('my recipes'))
			.toHaveAttribute('aria-current', 'page')
		await expect
			.element(
				screen
					.getByRole('main')
					.getByRole('link', { name: /Aria’s kitchen's recipes/ }),
			)
			.toBeVisible()
	})

	test('lets a signed-out visitor open signup from save', async () => {
		api.web.mockResolvedValue(recipe)

		const { screen } = await renderRoute({
			path: '/sites/example.com/pasta',
		})

		const save = screen.getByRole('button', { name: /^save / })
		await expect.element(save).toBeEnabled()
		await save.click()
		await expect
			.element(screen.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
	})

	test('drops pages preloaded as a visitor once the visitor signs up', async () => {
		api.web.mockResolvedValue(recipe)
		api.publicRecipe.mockResolvedValue(recipe)

		const { screen, router } = await renderRoute({
			path: '/sites/example.com/pasta',
		})

		// A visitor's touch preloads a published recipe's plain page.
		await router.preloadRoute({
			to: '/$handle/$slug',
			params: { handle: 'aria-amini', slug: 'weeknight-pasta' },
		})

		const preloaded = () =>
			router.stores.cachedMatches
				.get()
				.some((match) => match.routeId === '/_app/$handle/$slug')

		expect(preloaded()).toBe(true)

		getAuthMocks().signUpEmail.mockImplementationOnce(async () => {
			setMockSession(session)

			return { error: null }
		})
		await screen.getByRole('button', { name: /^save / }).click()
		const signup = screen.getByRole('dialog', { name: 'create an account' })
		await signup.getByLabelText('name').fill('Cook')
		await signup.getByLabelText('email').fill('cook@example.com')
		await signup.getByLabelText('password').fill('password123')
		await signup
			.getByRole('button', { name: 'create account', exact: true })
			.click()

		await expect.poll(preloaded).toBe(false)
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
			.element(screen.getByRole('link', { name: 'back to my recipes' }))
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
			.element(screen.getByRole('button', { name: /^save / }))
			.toBeVisible()
		expect(router.state.location.pathname).toBe('/aria-amini/weeknight-pasta')
	})
	test('shows a recipe saved at the tap, before the server answers', async () => {
		api.getRecipe.mockResolvedValue({
			...recipe,
			userId: 'someone',
			finalizedAt: new Date(),
			owned: false,
			saved: false,
			publicPath: '/aria-amini/weeknight-pasta',
			ingredientCategories: {},
		})

		let answer = () => {}

		api.saveRecipe.mockImplementation(
			() =>
				new Promise((resolve) => {
					answer = () => resolve(null)
				}),
		)

		const { screen } = await renderRoute({
			path: '/aria-amini/weeknight-pasta',
			session,
		})

		await screen.getByRole('button', { name: /^save / }).click()
		await expect
			.element(screen.getByRole('button', { name: /^unsave / }))
			.toBeVisible()
		expect(api.saveRecipe).toHaveBeenCalledOnce()

		answer()
		await expect
			.element(screen.getByText('saved to your recipes'))
			.toBeVisible()
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

		await screen.getByRole('button', { name: 'recipe options' }).click()
		await page.getByRole('menuitem', { name: 'share' }).click()
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

		await screen.getByRole('button', { name: /^unsave / }).click()
		await page.getByRole('button', { name: 'remove', exact: true }).click()

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/aria-amini/weeknight-pasta')
		expect(api.deleteRecipe).toHaveBeenCalledWith({
			data: { id: 'pasta', groceries: false },
		})
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
