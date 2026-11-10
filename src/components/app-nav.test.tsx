import { setMockSessionPending } from '@tests/support/mocks/browser'
import { getAuthMocks } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { desktopOnly, isPhone, phoneOnly } from '@tests/support/viewport'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page } from 'vitest/browser'

import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

const shelf = vi.hoisted<{ recipes: Recipe[] }>(() => ({ recipes: [] }))

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: shelf.recipes }),
	getRecipe: vi.fn(),
	createRecipe: vi.fn(),
	updateRecipe: vi.fn(),
	deleteRecipe: vi.fn(),
}))

vi.mock('@/lib/pantry/server', () => ({
	listPantry: async () => [],
	createPantryItems: vi.fn(),
	setPantryItemQuantity: vi.fn(),
	deletePantryItem: vi.fn(),
}))

vi.mock('@/lib/groceries/server', () => ({
	listGroceries: async () => [],
	addGroceries: vi.fn(),
	setGroceryChecked: vi.fn(),
	renameGrocery: vi.fn(),
	deleteGrocery: vi.fn(),
	clearCheckedGroceries: vi.fn(),
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

const misoButterPasta: Recipe = {
	id: 'recipe-1',
	userId: 'user-1',
	visibility: null,
	title: 'miso butter pasta',
	imageUrl: null,
	sourceUrl: null,
	links: [],
	sourceNotes: null,
	servings: null,
	totalMinutes: null,
	notes: null,
	createdAt: new Date(),
	finalizedAt: new Date(),
	cookCount: 0,
	lastCookedAt: null,
	forkedFromId: null,
	savedAt: new Date(),
}

// The tab bar below the md breakpoint, the sidebar above it.
describe('app nav', () => {
	beforeEach(() => {
		shelf.recipes = []
	})

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
			.toHaveAttribute('href', '/groceries')
		expect(router.state.location.pathname).toBe('/recipes')
		expect(
			nav
				.getByRole('link')
				.elements()
				.map((link) => link.textContent)
				.filter((label) => label !== 'cocochef' && label !== 'add'),
		).toEqual(['recipes', 'ingredients', 'groceries'])
	})

	test.each(['ingredients'])(
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
				.element(screen.getByRole('button', { name: /search any recipe/ }))
				.toBeVisible()
		},
	)

	test('opens the grocery list from navigation', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		await screen
			.getByRole('navigation', { name: 'Primary' })
			.getByRole('link', { name: 'groceries' })
			.click()
		await expect
			.element(screen.getByRole('textbox', { name: 'add an item' }))
			.toBeVisible()
	})

	test('puts settings and sign out in the account menu', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		await screen.getByRole('button', { name: 'Account' }).click()

		await expect.element(page.getByText('ada@example.com')).toBeVisible()
		await expect
			.element(page.getByRole('menuitem', { name: 'settings' }))
			.toHaveAttribute('href', '/settings')
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
			.element(
				page
					.getByRole('menuitem', { name: /create an account/ })
					.getByText('free', { exact: true }),
			)
			.toBeVisible()
		await page.getByRole('menuitem', { name: /create an account/ }).click()
		await expect
			.element(page.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
		const dialog = page.getByRole('dialog', { name: 'create an account' })
		await dialog.getByLabelText('name').fill('Cook')
		await dialog.getByLabelText('email').fill('cook@example.com')
		await dialog.getByLabelText('password').fill('password123')
		await dialog.getByRole('button', { name: 'create account' }).click()
		await vi.waitFor(() =>
			expect(getAuthMocks().signUpEmail).toHaveBeenCalledWith({
				name: 'Cook',
				email: 'cook@example.com',
				password: 'password123',
			}),
		)
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

	test('keeps the add button beside the empty shelf tile', async () => {
		const { screen } = await renderRoute({ path: '/recipes', session: member })

		await expect
			.element(screen.getByRole('button', { name: /save your first recipe/ }))
			.toBeVisible()
		// Where adding lives from the first visit on, so it never moves.
		await expect
			.element(screen.getByRole('button', { name: 'add recipe' }))
			.toBeVisible()
	})

	phoneOnly(
		'adds a recipe from a round button on the shelf, on phones',
		async () => {
			shelf.recipes = [misoButterPasta]

			const { screen } = await renderRoute({
				path: '/recipes',
				session: member,
			})

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
			await sheet.getByRole('button', { name: 'import' }).click()
			await expect
				.element(sheet.getByRole('option', { name: /blank recipe/ }))
				.toBeVisible()
			await expect
				.element(sheet.getByRole('option', { name: /import link/ }))
				.toBeVisible()
		},
	)

	test('keeps thumb targets at least 44px tall', async () => {
		const { screen } = await renderRoute({
			path: '/coming-soon/ingredients',
			session: member,
		})

		const nav = screen.getByRole('navigation', { name: 'Primary' })

		const heightOf = (target: { element: () => Element }) =>
			target.element().getBoundingClientRect().height

		await expect.element(nav).toBeVisible()

		// The sidebar is for a pointer; the tab bar is for thumbs.
		const targets = isPhone()
			? nav.getByRole('link').elements()
			: [nav.getByRole('link', { name: 'cocochef' }).element()]

		for (const link of targets)
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)

		expect(
			heightOf(screen.getByRole('link', { name: 'back to recipes' })),
		).toBeGreaterThanOrEqual(44)

		if (isPhone())
			expect(
				heightOf(
					screen.getByRole('banner').getByRole('button', { name: 'Account' }),
				),
			).toBeGreaterThanOrEqual(44)
	})

	phoneOnly(
		'leaves the tab bar off screens that pin their own actions',
		async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: member,
			})

			await expect
				.element(screen.getByRole('navigation', { name: 'Primary' }))
				.not.toBeInTheDocument()
		},
	)

	phoneOnly('steps aside while a text field has focus', async () => {
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

	desktopOnly(
		'lines the sidebar logo up with the nav rows, unboxed',
		async () => {
			const { screen } = await renderRoute({
				path: '/recipes',
				session: member,
			})

			const nav = screen.getByRole('navigation', { name: 'Primary' })
			const logo = nav.getByRole('link', { name: 'cocochef' })

			await expect.element(logo).toBeVisible()
			const logoBox = logo.element().getBoundingClientRect()

			const rowBox = nav
				.getByRole('link', { name: 'recipes' })
				.element()
				.getBoundingClientRect()

			// One column: the logo starts and ends where the rows do.
			expect(logoBox.left).toBe(rowBox.left)
			expect(logoBox.right).toBe(rowBox.right)
			// A mark on the sidebar, not a card of its own.
			const style = getComputedStyle(logo.element())

			expect(style.borderTopColor).toBe('rgba(0, 0, 0, 0)')
			expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)')
			expect(
				logo.element().querySelector('img')?.getBoundingClientRect().left,
			).toBeCloseTo(logoBox.left + 1, 0)
		},
	)

	test('shows the account photo', async () => {
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
