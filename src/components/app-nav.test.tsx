import { setMockSessionPending } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { describe, expect, test, vi } from 'vite-plus/test'
import { page } from 'vitest/browser'

vi.mock('@/lib/recipes/server', () => ({
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [], collections: [] }),
	getRecipe: vi.fn(),
	createRecipe: vi.fn(),
	updateRecipe: vi.fn(),
	deleteRecipe: vi.fn(),
	moveRecipe: vi.fn(),
	listBooks: vi.fn(),
	createBook: vi.fn(),
	renameBook: vi.fn(),
	deleteBook: vi.fn(),
}))

vi.mock('@/lib/pantry/server', () => ({
	listPantry: async () => [],
	createPantryItems: vi.fn(),
	setPantryItemQuantity: vi.fn(),
	deletePantryItem: vi.fn(),
}))

vi.mock('@/lib/shelf/server', () => ({
	getShelfStats: async () => ({ recipes: 2, pantryItems: 3 }),
}))

const member = {
	user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' },
	session: { id: 'session-1', token: 'token' },
}

const guest = {
	user: { ...member.user, name: 'Guest', isAnonymous: true },
	session: member.session,
}

// The tab bar below the md breakpoint, the sidebar above it.
const isPhone = () => window.innerWidth < 768

describe('app nav', () => {
	test('opens WIP pages for unfinished destinations and opens the shelf from the root', async () => {
		const { screen, router } = await renderRoute({ path: '/', session: member })

		const nav = screen.getByRole('navigation', { name: 'Primary' })
		await expect
			.element(nav.getByRole('link', { name: 'recipes' }))
			.toHaveAttribute('aria-current', 'page')
		await expect
			.element(nav.getByRole('link', { name: 'ingredients' }))
			.toHaveAttribute('href', '/coming-soon/ingredients')
		await expect
			.element(nav.getByRole('link', { name: 'groceries' }))
			.toHaveAttribute('href', '/coming-soon/groceries')
		expect(router.state.location.pathname).toBe('/recipes')
		expect(
			nav
				.getByRole('link')
				.elements()
				.map((link) => link.textContent)
				.filter((label) => label !== 'dutch-oven' && label !== 'add'),
		).toEqual(['recipes', 'ingredients', 'groceries'])
	})

	test.each(['ingredients', 'groceries'])(
		'opens the %s WIP page from navigation',
		async (label) => {
			const { screen } = await renderRoute({
				path: '/recipes',
				session: member,
			})

			await screen
				.getByRole('navigation', { name: 'Primary' })
				.getByRole('link', { name: label })
				.click()
			await expect
				.element(screen.getByRole('heading', { name: label, exact: true }))
				.toBeVisible()
			await expect.element(screen.getByText('work in progress')).toBeVisible()
			await screen.getByRole('link', { name: 'back to recipes' }).click()
			await expect
				.element(screen.getByRole('button', { name: /find a recipe/ }))
				.toBeVisible()
		},
	)

	test('puts profile and sign out in the account menu', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		await screen.getByRole('button', { name: 'Account' }).click()

		await expect.element(page.getByText('ada@example.com')).toBeVisible()
		await expect
			.element(page.getByRole('menuitem', { name: 'profile & photo' }))
			.toHaveAttribute('href', '/profile')
		await expect
			.element(page.getByRole('menuitem', { name: 'sign out' }))
			.toBeVisible()
	})

	test('invites guests to save their recipes', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: guest })

		await screen.getByRole('button', { name: 'Guest account' }).click()

		await expect
			.element(page.getByText('create an account to save your recipes'))
			.toBeVisible()
		await expect
			.element(page.getByRole('menuitem', { name: /create an account/ }))
			.toHaveAttribute('href', '/auth/signup')
		await expect
			.element(
				page
					.getByRole('menuitem', { name: /create an account/ })
					.getByText('free', { exact: true }),
			)
			.toBeVisible()
	})

	test('puts navigation in the thumb zone on phones and a sidebar on desktop', async () => {
		const { screen } = await renderRoute({
			path: '/ingredients',
			session: member,
		})

		const nav = screen.getByRole('navigation', { name: 'Primary' })
		const position = () => getComputedStyle(nav.element()).position

		await expect.element(nav).toBeVisible()

		if (isPhone()) {
			expect(position()).toBe('fixed')
			expect(nav.element().getBoundingClientRect().bottom).toBe(
				window.innerHeight,
			)
			// The account is a rare visit: an avatar in the header, not a tab.
			await expect
				.element(nav.getByRole('button', { name: 'Account' }))
				.not.toBeInTheDocument()
			await expect
				.element(
					screen.getByRole('banner').getByRole('button', { name: 'Account' }),
				)
				.toBeVisible()
			// The round add belongs to the recipes shelf alone.
			await expect
				.element(screen.getByRole('button', { name: 'add recipe' }))
				.not.toBeInTheDocument()
		} else {
			expect(position()).toBe('sticky')
		}
	})

	test('adds a recipe from a round button on the shelf, on phones', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		if (!isPhone()) return

		const add = screen.getByRole('button', { name: 'add recipe' })
		const box = add.element().getBoundingClientRect()

		expect(box.width).toBe(box.height)
		expect(getComputedStyle(add.element()).position).toBe('fixed')
		expect(box.bottom).toBeLessThan(window.innerHeight)
		await expect
			.element(
				screen
					.getByRole('navigation', { name: 'Primary' })
					.getByRole('button', { name: 'add recipe' }),
			)
			.not.toBeInTheDocument()

		// Every way to start lives in the finder.
		await add.click()
		const sheet = screen.getByRole('dialog', { name: 'find a recipe' })
		await expect
			.element(sheet.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveFocus()
		await expect
			.element(sheet.getByRole('option', { name: /blank recipe/ }))
			.toBeVisible()
		await expect
			.element(sheet.getByRole('option', { name: /import link/ }))
			.toBeVisible()
	})

	test('leaves the tab bar off screens that pin their own actions', async () => {
		if (!isPhone()) return

		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: member,
		})

		await expect
			.element(screen.getByRole('navigation', { name: 'Primary' }))
			.not.toBeInTheDocument()
	})

	test('steps aside while a text field has focus', async () => {
		if (!isPhone()) return

		const { screen } = await renderRoute({ path: '/recipes', session: member })
		const nav = screen.getByRole('navigation', { name: 'Primary' })

		await expect.element(nav).toBeVisible()

		// Any text field counts, wherever it is on the page.
		const field = document.createElement('input')
		document.body.append(field)
		field.focus()
		// Hidden elements drop out of the role tree.
		await expect.element(nav).not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'add recipe' }))
			.not.toBeInTheDocument()
		field.remove()
	})

	test('shows the account photo, or the same initial fallback without one', async () => {
		const withPhoto = {
			...member,
			user: { ...member.user, image: '/sprites/pantry/apple.png' },
		}

		const { screen } = await renderRoute({
			path: '/recipes',
			session: withPhoto,
		})

		const button = screen.getByRole('button', { name: 'Account' })

		await expect.element(button).toBeVisible()
		expect(button.element().querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/pantry/apple.png',
		)
	})

	test('holds the avatar spot while the session loads, with no label', async () => {
		const { screen } = await renderRoute({
			path: '/recipes',
			session: member,
			setup: () => setMockSessionPending(),
		})

		const area = isPhone()
			? screen.getByRole('banner')
			: screen.getByRole('navigation', { name: 'Primary' })

		await expect.element(area).toBeVisible()
		expect(area.element().textContent).not.toContain('account')

		const spot = area.element().querySelector('.animate-pulse')

		if (!spot) throw new Error('missing placeholder')
		// The same footprint as the avatar that replaces it, so nothing shifts.
		expect(spot.getBoundingClientRect().width).toBe(isPhone() ? 32 : 24)
	})

	test('offers sign in when signed out', async () => {
		const { screen } = await renderRoute({ path: '/recipes' })

		await expect
			.element(screen.getByRole('link', { name: 'sign in' }))
			.toHaveAttribute('href', '/auth/login')
	})
})
