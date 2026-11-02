import { getAuthMocks, setMockSessionError } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vite-plus/test/browser'

const transfer = vi.hoisted(() => ({
	exported: vi.fn(),
	imported: vi.fn(),
}))

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/lib/recipes/server')>()),
	exportRecipes: transfer.exported,
	importRecipes: transfer.imported,
}))

vi.mock('@/lib/s3', () => ({
	getAvatarUrl: async ({ data }: { data: { image?: string | null } }) =>
		data.image || undefined,
	getAvatarUploadUrl: vi.fn(),
}))

vi.mock('@/lib/shelf/server', () => ({
	getShelfStats: async () => ({ recipes: 0, pantryItems: 0 }),
}))

describe('profile account states', () => {
	test('offers sign-in instead of upload controls without a session', async () => {
		const { screen } = await renderRoute({ path: '/profile' })
		await expect
			.element(
				screen
					.getByRole('main')
					.getByRole('link', { name: 'sign in', exact: true }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByLabelText('Profile photo'))
			.not.toBeInTheDocument()
	})
	test('offers a retry instead of sign-in when the session lookup fails', async () => {
		const { screen } = await renderRoute({
			path: '/profile',
			setup: () => setMockSessionError(new Error('network down')),
		})

		await expect.element(screen.getByRole('alert')).toBeVisible()
		await expect
			.element(
				screen
					.getByRole('main')
					.getByRole('link', { name: 'sign in', exact: true }),
			)
			.not.toBeInTheDocument()

		const { refetchSession } = getAuthMocks()
		refetchSession.mockClear()

		await screen.getByRole('button', { name: 'try again' }).click()
		expect(refetchSession).toHaveBeenCalledTimes(1)
	})

	test('offers account creation instead of upload controls for guests', async () => {
		const { screen } = await renderRoute({
			path: '/profile',
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
			.element(screen.getByRole('link', { name: 'keep my shelf', exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByLabelText('Profile photo'))
			.not.toBeInTheDocument()
	})

	test('loads the existing avatar for a registered account', async () => {
		const { screen } = await renderRoute({
			path: '/profile',
			session: {
				user: {
					id: 'cook',
					name: 'Cook',
					email: 'cook@example.com',
					image: '/sprites/pantry/apple.png',
				},
				session: { id: 'cook-session', token: 'token' },
			},
		})

		await expect
			.element(screen.getByRole('img', { name: 'Profile avatar' }))
			.toHaveAttribute('src', '/sprites/pantry/apple.png')
		await expect.element(screen.getByLabelText('Profile photo')).toBeVisible()
	})

	describe('moving recipes between kitchens', () => {
		const cook = {
			user: { id: 'cook', name: 'Cook', email: 'cook@example.com' },
			session: { id: 'cook-session', token: 'token' },
		}

		afterEach(() => vi.restoreAllMocks())

		test('imports a recipe file and says what was new and what was already here', async () => {
			transfer.imported.mockResolvedValue({ imported: 2, skipped: 1 })
			const { screen } = await renderRoute({ path: '/profile', session: cook })
			const text = '{"format":"dutch-oven/recipes","version":1,"recipes":[]}'

			await userEvent.upload(
				screen.getByLabelText('recipe file'),
				new File([text], 'recipes.json', { type: 'application/json' }),
			)

			await expect
				.element(screen.getByText('2 recipes imported, 1 already here'))
				.toBeVisible()
			expect(transfer.imported).toHaveBeenCalledWith({ data: { text } })
		})

		test('shows why a file was refused', async () => {
			transfer.imported.mockRejectedValue(
				new Error("that isn't a dutch-oven recipe file"),
			)
			const { screen } = await renderRoute({ path: '/profile', session: cook })

			await userEvent.upload(
				screen.getByLabelText('recipe file'),
				new File(['nope'], 'notes.json', { type: 'application/json' }),
			)

			await expect
				.element(screen.getByRole('alert'))
				.toHaveTextContent("that isn't a dutch-oven recipe file")
		})

		test('exports the whole shelf as a file, for guests too', async () => {
			transfer.exported.mockResolvedValue({
				format: 'dutch-oven/recipes',
				version: 1,
				exportedAt: new Date().toISOString(),
				recipes: [{ title: 'dal' }],
			})

			const click = vi
				.spyOn(HTMLAnchorElement.prototype, 'click')
				.mockImplementation(() => undefined)

			const { screen } = await renderRoute({
				path: '/profile',
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

			await screen.getByRole('button', { name: 'export all recipes' }).click()
			await expect.element(screen.getByText('exported 1 recipe')).toBeVisible()
			expect(transfer.exported).toHaveBeenCalledWith({ data: {} })
			expect(click).toHaveBeenCalledTimes(1)
		})
	})
})
