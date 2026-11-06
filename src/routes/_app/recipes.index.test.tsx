import { expectScreenshot } from '@aamini/config/vitest/browser'
import { renderRoute } from '@tests/support/render/route'
import { desktopOnly, isPhone } from '@tests/support/viewport'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

type ShelfState = {
	recipes: Recipe[]
}

const shelfState = vi.hoisted<ShelfState>(() => ({
	recipes: [],
}))

const discovery = vi.hoisted(() => ({
	search: vi.fn(),
	popular: vi.fn(),
	import: vi.fn(),
}))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: discovery.search,
	popularRecipes: discovery.popular,
}))

vi.mock('@/lib/import/server', () => ({ importRecipe: discovery.import }))

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	copyRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: shelfState.recipes }),
	getRecipe: ({ data }: { data: { id: string } }) => {
		const recipe = shelfState.recipes.find((recipe) => recipe.id === data.id)

		return Promise.resolve(
			recipe ? { ...recipe, ingredients: [], steps: [] } : null,
		)
	},
	createRecipe: () => Promise.resolve(),
	deleteRecipe: () => Promise.resolve(),
	updateRecipe: () => Promise.resolve(),
}))

const testSession = {
	user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
	session: { id: 'session-1', token: 'token' },
}

const misoButterPasta: Recipe = {
	id: 'recipe-1',
	userId: 'user-1',
	visibility: null,
	title: 'miso butter pasta',
	imageUrl: null,
	sourceUrl: null,
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

const dal: Recipe = {
	id: 'recipe-2',
	userId: 'user-1',
	visibility: null,
	title: 'dal',
	imageUrl: null,
	sourceUrl: null,
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

// The command glyph comes from whichever system font has it, so a baseline
// would only match the machine that made it.
const hideShortcutHints = () => {
	for (const hint of document.querySelectorAll('kbd')) {
		hint.style.visibility = 'hidden'
	}
}

describe('recipes shelf', () => {
	beforeEach(() => {
		shelfState.recipes = []
		discovery.search.mockReset().mockResolvedValue({
			results: [
				{
					title: 'online ramen',
					url: 'https://example.com/ramen',
					siteName: 'Example',
					saved: false,
					draft: false,
					ingredientMatches: [],
					siteId: 'example',
				},
			],
			warming: false,
		})
		discovery.popular.mockReset().mockResolvedValue({
			warming: false,
			results: [],
		})
		discovery.import
			.mockReset()
			.mockRejectedValue(new Error('Import failed. Please retry.'))
	})

	test('separates owned and saved recipes into their own sections', async () => {
		shelfState.recipes = [
			{ ...misoButterPasta, visibility: 'public' },
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const yours = screen.getByRole('region', { name: 'your recipes' })
		const saved = screen.getByRole('region', { name: 'saved recipes' })
		await expect.element(yours.getByText('miso butter pasta')).toBeVisible()
		await expect.element(saved.getByText('shared soup')).toBeVisible()
		await expect.element(yours.getByText('shared soup')).not.toBeInTheDocument()
	})

	test('invites the first save when the shelf is empty', async () => {
		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByText('save your first recipe', { exact: false }))
			.toBeVisible()
		await screen.getByRole('button', { name: /save your first recipe/ }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveFocus()
	})

	test('shows search and the ways to add a recipe', async () => {
		shelfState.recipes = [misoButterPasta, dal]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect.element(screen.getByText('miso butter pasta')).toBeVisible()
		await expect.element(screen.getByText('dal')).toBeVisible()

		// The add action opens the finder on desktop and phones.
		if (isPhone())
			await expect
				.element(screen.getByRole('button', { name: 'add recipe' }))
				.toBeVisible()
		else {
			await expect
				.element(screen.getByRole('button', { name: 'add recipe' }))
				.toBeVisible()
			await expect
				.element(screen.getByRole('button', { name: 'import link' }))
				.toBeVisible()
		}

		await expect
			.element(screen.getByRole('button', { name: /Search any Recipe/ }))
			.toBeVisible()
	})

	test('shows popular recipes under your own and opens them', async () => {
		shelfState.recipes = [dal]
		discovery.popular.mockResolvedValue({
			warming: false,
			results: [
				{
					recipeId: misoButterPasta.id,
					title: 'shared miso pasta',
					siteName: 'cocochef',
					saved: false,
					draft: false,
					ingredientMatches: [],
				},
				{
					url: 'https://example.com/ramen',
					title: 'site ramen',
					siteName: 'Example',
					saved: false,
					draft: false,
					ingredientMatches: [],
				},
			],
		})
		discovery.import.mockResolvedValue({ id: dal.id, title: 'dal' })

		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const yours = screen.getByRole('region', { name: 'your recipes' })
		const popular = screen.getByRole('region', { name: 'discover recipes' })

		await expect.element(yours.getByText('dal')).toBeVisible()
		await expect
			.element(popular.getByRole('link', { name: /shared miso pasta/ }))
			.toHaveAttribute('href', '/recipes/recipe-1')

		await popular.getByRole('button', { name: 'browse more recipes' }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveFocus()
		await userEvent.keyboard('{Escape}')

		await popular.getByRole('button', { name: /site ramen/ }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-2')
		// Looking at a recipe from a site leaves it off the shelf.
		expect(discovery.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/ramen', keep: false },
		})
	})

	test('keeps discovery to one compact row within the screen', async () => {
		shelfState.recipes = [dal]
		discovery.popular.mockResolvedValue({
			warming: false,
			results: Array.from({ length: 40 }, (_, index) => ({
				recipeId: 'popular-' + index,
				title: 'popular recipe ' + index,
				siteName: 'Example',
				saved: false,
				draft: false,
				ingredientMatches: [],
			})),
		})

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const yours = screen.getByRole('region', { name: 'your recipes' })
		const discover = screen.getByRole('region', { name: 'discover recipes' })
		const first = discover.getByRole('link', { name: /popular recipe 0/ })
		await expect.element(first).toBeVisible()
		// Only what the row can show is rendered, however many were found.
		expect(discover.getByRole('link').elements().length).toBeLessThanOrEqual(4)
		const ownBounds = yours.getByRole('link').element().getBoundingClientRect()
		const foundBounds = first.element().getBoundingClientRect()
		expect(foundBounds.left).toBe(ownBounds.left)
		expect(foundBounds.height).toBeLessThan(ownBounds.height)

		if (!isPhone()) {
			expect(
				Math.abs(
					discover.element().getBoundingClientRect().right -
						screen
							.getByRole('button', { name: 'add recipe', exact: true })
							.element()
							.getBoundingClientRect().right,
				),
			).toBeLessThan(1)
		}

		const visible = [...discover.element().querySelectorAll('a')].filter(
			(node) => getComputedStyle(node).display !== 'none',
		)

		expect(visible.length).toBe(isPhone() ? 2 : 4)

		for (const tile of visible)
			expect(tile.getBoundingClientRect().top).toBe(foundBounds.top)

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		)
	})

	test('holds the popular row with placeholders while it loads', async () => {
		discovery.popular.mockReturnValue(new Promise(() => {}))

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('region', { name: 'discover recipes' }))
			.toHaveAttribute('aria-busy', 'true')
	})

	test('ends the shelf cleanly when popular recipes fail to load', async () => {
		discovery.popular.mockRejectedValue(new Error('offline'))

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByText('save your first recipe', { exact: false }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('region', { name: 'discover recipes' }))
			.not.toBeInTheDocument()
	})

	desktopOnly('imports a link from the button beside the search', async () => {
		discovery.import.mockResolvedValue({ id: dal.id, title: 'dal' })
		shelfState.recipes = [dal]

		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'import link' }).click()
		const field = screen.getByRole('textbox', { name: 'recipe link' })

		await expect.element(field).toHaveFocus()

		await field.fill('not a link')
		await screen.getByRole('button', { name: 'import', exact: true }).click()
		await expect
			.element(
				screen.getByText('that doesn’t look like a link', { exact: false }),
			)
			.toBeVisible()
		expect(discovery.import).not.toHaveBeenCalled()

		// Links copied without their https:// still work.
		await field.fill('example.com/dal')
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-2')
		expect(discovery.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/dal', keep: true },
		})
	})

	test('puts the title beside a recipe photo, not over it', async () => {
		shelfState.recipes = [{ ...dal, imageUrl: '/sprites/pantry/apple.png' }]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const card = screen.getByRole('link', { name: 'dal' })
		const photo = card.element().querySelector('img')
		const title = card.element().querySelector('h3')

		if (!photo || !title) throw new Error('card is missing its photo or title')
		await expect.element(screen.getByText('dal')).toBeVisible()
		expect(photo.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			title.getBoundingClientRect().top + 1,
		)
	})

	test('labels a draft', async () => {
		shelfState.recipes = [{ ...dal, finalizedAt: null }, misoButterPasta]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const draft = screen.getByRole('link', { name: /dal/ })

		await expect.element(draft).toBeVisible()
		expect(draft.element().textContent).toBe('draftdal')
	})

	// Full-page captures of the shelf. The sidebar on desktop, the tab bar and
	// round add button on a phone come along with the content.
	test('captures the empty shelf', async () => {
		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('button', { name: /save your first recipe/ }))
			.toBeVisible()
		hideShortcutHints()
		await expectScreenshot(screen.container, 'shelf-empty', {
			fullHeight: true,
		})
	})

	test('captures the shelf with a draft, a saved recipe and discovery', async () => {
		shelfState.recipes = [
			{ ...dal, finalizedAt: null },
			misoButterPasta,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]
		discovery.popular.mockResolvedValue({
			warming: false,
			results: [
				{ title: 'abcd', imageUrl: '/sprites/pantry/apple.png' },
				{ title: 'abcde' },
				{ title: 'abcdef' },
				{ title: 'abcdefg' },
			].map((recipe) => ({
				...recipe,
				recipeId: 'id-' + recipe.title,
				siteName: 'Example',
				saved: false,
				draft: false,
				ingredientMatches: [],
			})),
		})

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('link', { name: /dal/ }))
			.toBeVisible()
		hideShortcutHints()
		await expectScreenshot(screen.container, 'shelf', { fullHeight: true })
	})
})
