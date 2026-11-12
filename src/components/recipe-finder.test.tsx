import { renderRoute } from '@tests/support/render/route'
import { expectIsolatedScreenshot } from '@tests/support/screenshot'
import { desktopOnly, isPhone, phoneOnly } from '@tests/support/viewport'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { FoundRecipe } from '@/lib/discover/server'
import { recipeSites } from '@/lib/discover/sites'
import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

const shelfState = vi.hoisted<{ recipes: Recipe[] }>(() => ({ recipes: [] }))

const server = vi.hoisted(() => ({
	search: vi.fn(),
	popular: vi.fn(),
	import: vi.fn(),
	save: vi.fn(),
	getRecipe: vi.fn(),
}))

vi.mock('@/lib/groceries/server', () => ({
	listGroceries: async () => [],
	countWaitingGroceries: async () => 0,
	addGroceries: vi.fn(),
	setGroceryChecked: vi.fn(),
	renameGrocery: vi.fn(),
	deleteGrocery: vi.fn(),
	clearCheckedGroceries: vi.fn(),
}))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: server.search,
	popularRecipes: server.popular,
}))

vi.mock('@/lib/import/server', () => ({ importRecipe: server.import }))

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	// The recipe page a search opens needs the rest, which it never calls here.
	...(await importOriginal<object>()),
	removeSavedRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: shelfState.recipes }),
	getRecipe: server.getRecipe,
	saveRecipe: server.save,
	createRecipe: () => Promise.resolve({ id: 'recipe-new' }),
	updateRecipe: () => Promise.resolve({ id: 'recipe-new' }),
	deleteRecipe: () => Promise.resolve(),
}))

const testSession = {
	user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
	session: { id: 'session-1', token: 'token' },
}

type SearchReply = { warming: boolean; results: FoundRecipe[] }

function shelfRecipe(id: string, title: string, extra: Partial<Recipe> = {}) {
	return {
		id,
		userId: 'user-1',
		title,
		imageUrl: null,
		sourceUrl: null,
		links: [],
		sourceNotes: null,
		servings: null,
		totalMinutes: null,
		ratingValue: null,
		ratingCount: null,
		commentCount: null,
		notes: null,
		createdAt: new Date(),
		finalizedAt: new Date(),
		cookCount: 0,
		lastCookedAt: null,
		forkedFromId: null,
		savedAt: new Date(),
		visibility: null,
		...extra,
	} satisfies Recipe
}

function found(extra: Partial<FoundRecipe> & { title: string }): FoundRecipe {
	return {
		siteName: 'Example',
		saved: false,
		draft: false,
		ingredientMatches: [],
		...extra,
	}
}

const miso = shelfRecipe('recipe-1', 'miso butter pasta', {
	cookCount: 3,
	lastCookedAt: new Date(),
})

const dal = shelfRecipe('recipe-2', 'dal')

async function openBox() {
	const rendered = await renderRoute({ path: '/recipes', session: testSession })

	await rendered.screen
		.getByRole('button', { name: /search any recipe/ })
		.click()
	const input = rendered.screen.getByRole('combobox', { name: 'find a recipe' })

	await expect.element(input).toHaveFocus()

	const popup = rendered.screen.getByRole('dialog', { name: 'find a recipe' })

	return { ...rendered, input, popup }
}

describe('the one box', () => {
	beforeEach(() => {
		shelfState.recipes = []
		server.search.mockReset().mockResolvedValue({ warming: false, results: [] })
		server.popular
			.mockReset()
			.mockResolvedValue({ warming: false, results: [] })
		server.import
			.mockReset()
			.mockRejectedValue(new Error('Import failed. Please retry.'))
		server.save.mockReset().mockResolvedValue({})
		server.getRecipe.mockReset().mockResolvedValue(null)
	})

	desktopOnly(
		'keeps the popup in the visible area when a keyboard is up on a wide screen',
		async () => {
			await openBox()

			// Narrow screens size from the same variables; this guards the wide layout.
			const popup = document.querySelector('[role="dialog"]')

			if (!(popup instanceof HTMLElement)) throw new Error('no popup')

			const rect = () => popup.getBoundingClientRect()

			// Without a keyboard the popup keeps its 2rem margins around the viewport.
			expect(rect().top).toBe(32)
			expect(Math.round(rect().height)).toBe(window.innerHeight - 64)

			// The visible area a keyboard leaves: the popup fits it, margins kept.
			document.documentElement.style.setProperty('--vv-top', '20px')
			document.documentElement.style.setProperty('--vv-height', '500px')

			await expect.poll(() => Math.round(rect().height)).toBe(500 - 64)
			expect(Math.round(rect().top)).toBe(20 + 32)
		},
	)

	test('shows only popular recipes before anything is typed', async () => {
		shelfState.recipes = [
			shelfRecipe('draft-1', 'shakshuka', { finalizedAt: null }),
			miso,
		]
		server.popular.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'marry me chicken' })],
		})

		const { screen } = await openBox()

		// The shelf is behind the box already; an empty search browses others'.
		await expect
			.element(screen.getByRole('option', { name: /marry me chicken/ }))
			.toBeVisible()
		await expect
			.element(screen.getByText('still writing'))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('option', { name: /shakshuka/ }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('option', { name: /blank recipe/ }))
			.not.toBeInTheDocument()
	})

	test('pastes a recipe from the add menu, or closes on cancel', async () => {
		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const paste = async () => {
			await screen.getByRole('button', { name: 'add recipe' }).click()
			await screen.getByRole('menuitem', { name: 'paste text' }).click()

			return screen.getByRole('dialog', { name: 'paste a recipe' })
		}

		const first = await paste()
		await first.getByRole('textbox', { name: 'recipe text' }).fill('Pasta')
		await first.getByRole('button', { name: 'cancel' }).click()
		await expect.element(first).not.toBeInTheDocument()

		const dialog = await paste()
		await dialog
			.getByRole('textbox', { name: 'recipe text' })
			.fill('weeknight dal\ningredients\n1 cup lentils\nmethod\n1. simmer')
		await dialog.getByRole('button', { name: 'add recipe' }).click()
		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
		// The editor loads on first visit, which can be slow when cold.
		await expect
			.element(screen.getByRole('textbox', { name: 'name', exact: true }), {
				timeout: 10_000,
			})
			.toHaveValue('weeknight dal')
	})

	test('opens from anywhere with ⌘K and closes with escape', async () => {
		const { screen } = await renderRoute({
			path: '/groceries',
			session: testSession,
		})

		await userEvent.keyboard('{Control>}k{/Control}')
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveFocus()
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.not.toBeInTheDocument()
	})

	test('reveals more recipes a page at a time until none are left', async () => {
		server.popular.mockResolvedValue({
			warming: false,
			results: Array.from({ length: 30 }, (_, i) =>
				found({
					title: `stew ${i + 1}`,
					url: `https://example.com/stew-${i + 1}`,
				}),
			),
		})

		const { screen } = await openBox()

		const shown = () =>
			screen.getByRole('option', { name: /^stew \d+/ }).elements().length

		await expect.poll(shown).toBe(12)
		await screen.getByRole('button', { name: 'show more recipes' }).click()
		await expect.poll(shown).toBe(24)
		await screen.getByRole('button', { name: 'show more recipes' }).click()
		await expect.poll(shown).toBe(30)
		await expect
			.element(screen.getByRole('button', { name: 'show more recipes' }))
			.not.toBeInTheDocument()
	})

	test('marks each recipe with the logo of its site', async () => {
		server.popular.mockResolvedValue({
			warming: false,
			results: [
				found({
					title: 'quick kimchi',
					url: 'https://www.bbcgoodfood.com/recipes/quick-kimchi',
					siteName: 'BBC Good Food',
				}),
				found({ title: 'plain stew', url: 'https://example.com/stew' }),
			],
		})

		const { screen } = await openBox()

		const logoOf = (name: RegExp) =>
			screen.getByRole('option', { name }).element().querySelector('img')

		await expect
			.element(screen.getByRole('option', { name: /quick kimchi/ }))
			.toBeVisible()
		expect(logoOf(/quick kimchi/)?.getAttribute('src')).toBe(
			'/import-sites/bbcgoodfood.png',
		)
		expect(logoOf(/plain stew/)).toBeNull()
	})

	test("names a shelf recipe's site only while its source link is set", async () => {
		shelfState.recipes = [
			shelfRecipe('recipe-1', 'quick kimchi', {
				sourceUrl: 'https://www.bbcgoodfood.com/recipes/quick-kimchi',
			}),
			dal,
		]
		// Shelf names match while the server is still searching.
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, input } = await openBox()

		const row = (name: RegExp) => screen.getByRole('option', { name })

		await input.fill('kimchi')
		await expect.element(row(/quick kimchi/)).toBeVisible()
		expect(
			row(/quick kimchi/)
				.element()
				.querySelector('img'),
		).not.toBeNull()
		expect(row(/quick kimchi/).element().textContent).toContain(
			'bbcgoodfood.com',
		)

		// Made your own: no site, no logo, and no text in its place.
		await input.fill('dal')
		await expect.element(row(/^dal/)).toBeVisible()
		expect(row(/^dal/).element().querySelector('img')).toBeNull()
		expect(row(/^dal/).element().textContent).toBe('dal')
	})

	test('names every searched site with a logo that loads', async () => {
		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const search = screen.getByRole('button', { name: /search any recipe/ })

		// Every site is named to a screen reader, whatever fits on screen.
		for (const site of recipeSites)
			await expect
				.element(search)
				.toHaveAccessibleName(
					new RegExp(site.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
				)

		const logos = () =>
			Array.from(
				search.element().querySelectorAll<HTMLImageElement>('[data-site-logo]'),
			)

		// A few logos stand for the rest, and every one shown loads.
		await expect.poll(() => logos().length).toBe(4)
		await expect
			.poll(() => logos().every((logo) => logo.naturalWidth > 0))
			.toBe(true)
		await expect
			.element(search.getByText(`+${recipeSites.length - 4}`))
			.toBeInTheDocument()
	})

	test('finds shelf recipes by name at once and opens one with enter', async () => {
		shelfState.recipes = [miso, dal]
		// The server is slow; names on the shelf match without it.
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, router, input } = await openBox()

		await input.fill('mis')
		await expect
			.element(screen.getByText('on your shelf').first())
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toHaveAttribute('aria-selected', 'true')
		await expect
			.element(screen.getByRole('option', { name: /^dal/ }))
			.not.toBeInTheDocument()
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'back to results' }))
			.toBeVisible()
		expect(router.state.location.pathname).toBe('/recipes')
		server.getRecipe.mockResolvedValue({
			...miso,
			ingredients: ['200 g pasta'],
			steps: ['boil'],
			saved: true,
			owned: true,
		})
		await screen.getByRole('button', { name: 'open recipe' }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-1')

		// The recipe's way back is to the search it came from.
		await screen.getByRole('button', { name: 'back to results' }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveValue('mis')
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toBeVisible()
	})

	phoneOnly(
		'opens full screen on phones, square, with the bar at the top',
		async () => {
			const { input } = await openBox()
			const dialog = document.querySelector('[role="dialog"]')

			if (!dialog) throw new Error('missing finder dialog')
			const box = dialog.getBoundingClientRect()

			expect(box.top).toBe(0)
			expect(box.height).toBe(window.innerHeight)
			expect(getComputedStyle(dialog).borderTopLeftRadius).toBe('0px')
			await expect.element(input).toBeVisible()
			expect(
				input.element().getBoundingClientRect().top,
			).toBeGreaterThanOrEqual(0)
		},
	)

	test('keeps the search bar on screen while a recipe is previewed', async () => {
		shelfState.recipes = [miso]
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, input } = await openBox()

		await input.fill('mis')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'back to results' }))
			.toBeVisible()
		await expect.element(input).toBeVisible()

		// Typing again leaves the preview for the new search.
		await input.fill('dal')
		await expect
			.element(screen.getByRole('button', { name: 'back to results' }))
			.not.toBeInTheDocument()
	})

	test('moves through recipes with the keyboard', async () => {
		shelfState.recipes = [miso, dal]
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, router, input } = await openBox()

		await input.fill('a')
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{ArrowDown}')
		await expect
			.element(screen.getByRole('option', { name: /^dal/ }))
			.toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{Enter}')
		await screen.getByRole('button', { name: 'open recipe' }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-2')
	})

	test('says when a recipe matched on its ingredients', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					recipeId: 'recipe-9',
					title: 'traybake',
					saved: true,
					ingredientMatches: ['lemon', 'thighs'],
				}),
				found({ recipeId: 'shared-1', title: 'lemon chicken thighs' }),
			],
		})

		const { screen, input } = await openBox()

		await input.fill('lemon thighs')
		await expect
			.element(screen.getByRole('option', { name: /has lemon, thighs/ }))
			.toBeVisible()
		await expect.element(screen.getByText('more recipes')).toBeVisible()
		expect(server.search).toHaveBeenCalledWith({ data: { q: 'lemon thighs' } })
	})

	test('shows how found recipes were rated, and puts the most loved first', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-2', title: 'lemon tart' }),
				found({
					recipeId: 'shared-1',
					title: 'lemon chicken',
					rating: { value: 4.86, count: 1204 },
				}),
			],
		})

		const { screen, input } = await openBox()

		await input.fill('lemon')
		await expect
			.element(
				screen
					.getByRole('option', { name: /lemon chicken/ })
					.getByLabelText('rated 4.9 by 1204'),
			)
			.toBeVisible()
		expect(
			screen
				.getByRole('option', { name: /lemon tart/ })
				.getByLabelText(/^rated/)
				.all(),
		).toHaveLength(0)

		const titles = () =>
			screen
				.getByRole('option', { name: /^lemon (tart|chicken)/ })
				.elements()
				.map((option) => /lemon (tart|chicken)/.exec(option.textContent)?.[0])

		expect(titles()).toEqual(['lemon tart', 'lemon chicken'])
		await screen.getByRole('button', { name: 'most loved' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'most loved' }))
			.toHaveAttribute('aria-pressed', 'true')
		expect(titles()).toEqual(['lemon chicken', 'lemon tart'])
	})

	test('keeps hover previews free of actions until a recipe is selected', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
			ingredients: ['6 chicken thighs', '1 lemon'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})
		const { screen, input } = await openBox()
		await input.fill('lemon')
		const option = screen.getByRole('option', { name: /lemon chicken/ })
		await option.hover()

		if (!isPhone())
			await expect.element(screen.getByText('6 chicken thighs')).toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'open recipe' }))
			.not.toBeInTheDocument()
		await option.click()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'open recipe' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'start from this' }))
			.not.toBeInTheDocument()
	})

	test('keeps the focused action when the previewed recipe finishes loading', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		type Loaded = Recipe & {
			ingredients: string[]
			steps: string[]
			saved: boolean
			owned: boolean
		}

		let load: (recipe: Loaded) => void = () => {}

		server.getRecipe.mockReturnValue(new Promise((resolve) => (load = resolve)))
		const { screen, input } = await openBox()
		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon chicken/ }).click()

		const save = () => screen.getByRole('button', { name: 'save', exact: true })

		await expect.element(save()).toBeVisible()
		save().element().focus()
		load({
			...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
			ingredients: ['6 chicken thighs', '1 lemon'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})
		await expect.element(screen.getByText('6 chicken thighs')).toBeVisible()
		await expect.element(save()).toHaveFocus()
	})

	test('keeps the focused action while a site page is brought in', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/ramen', title: 'online ramen' }),
			],
		})

		let bring: (recipe: { id: string; title: string }) => void = () => {}

		server.import.mockReturnValue(new Promise((resolve) => (bring = resolve)))
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-ramen', 'online ramen', { userId: null }),
			ingredients: ['200 g ramen noodles'],
			steps: ['boil'],
			saved: false,
			owned: false,
		})
		const { screen, input } = await openBox()
		await input.fill('ramen')
		await screen.getByRole('option', { name: /online ramen/ }).click()

		const save = () => screen.getByRole('button', { name: 'save', exact: true })

		await expect.element(save()).toBeVisible()
		save().element().focus()
		bring({ id: 'shared-ramen', title: 'online ramen' })
		await expect.element(screen.getByText('200 g ramen noodles')).toBeVisible()
		await expect.element(save()).toHaveFocus()
	})

	test('says so when a previewed recipe can no longer be read', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		// A recipe made private after the results loaded comes back empty.
		server.getRecipe.mockResolvedValue(null)
		const { screen, input } = await openBox()
		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon chicken/ }).click()

		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent("couldn't read this recipe — try opening it.")
	})

	test('selects a full-height preview and opens without saving', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
			ingredients: ['6 chicken thighs', '1 lemon'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})
		const { screen, router, input } = await openBox()
		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon chicken/ }).click()
		await expect.element(screen.getByText('6 chicken thighs')).toBeVisible()
		expect(router.state.location.pathname).toBe('/recipes')
		expect(server.save).not.toHaveBeenCalled()
		// Its actions sit under the title, as on the recipe's own page.
		const add = screen.getByRole('button', { name: 'open recipe' })
		await expect.element(add).toBeVisible()
		expect(add.element().getBoundingClientRect().top).toBeGreaterThan(
			screen
				.getByRole('heading', { name: /lemon chicken/ })
				.element()
				.getBoundingClientRect().top,
		)

		const dialog = document.querySelector('[role="dialog"]')

		if (!dialog) throw new Error('missing finder dialog')
		expect(dialog.getBoundingClientRect().height).toBe(
			window.innerHeight - (isPhone() ? 0 : 64),
		)
		expect(router.state.location.pathname).toBe('/recipes')
		await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
		await expect
			.element(screen.getByText('roast', { exact: true }))
			.toBeVisible()
		await screen.getByRole('button', { name: 'back to results' }).click()
		await expect.element(input).toHaveValue('lemon')
		await expect.element(input).toHaveFocus()
		await screen.getByRole('option', { name: /lemon chicken/ }).click()
		await screen.getByRole('button', { name: 'open recipe' }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/shared-1')
		expect(server.save).not.toHaveBeenCalled()
	})

	test('saves a previewed recipe in one tap, staying in the search', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-1', title: 'lemon chicken' }),
				found({ url: 'https://example.com/dal', title: 'tadka dal' }),
			],
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
			ingredients: ['6 chicken thighs'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})
		server.save.mockResolvedValue({ id: 'shared-1' })
		server.import.mockResolvedValue({ id: 'shared-2' })
		const { screen, router, input } = await openBox()
		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon chicken/ }).click()
		await screen.getByRole('button', { name: 'save', exact: true }).click()

		await expect
			.element(screen.getByText('saved', { exact: true }))
			.toBeVisible()
		expect(server.save).toHaveBeenCalledWith({ data: { id: 'shared-1' } })
		expect(router.state.location.pathname).toBe('/recipes')

		// A site page is brought in and kept in one go.
		await screen.getByRole('button', { name: 'back to results' }).click()
		await screen.getByRole('option', { name: /tadka dal/ }).click()
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.element(screen.getByText('saved', { exact: true }))
			.toBeVisible()
		expect(server.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/dal', keep: true },
		})
	})

	test('keeps the selected preview when discovery refreshes a URL into a recipe ID', async () => {
		const chosen = found({
			url: 'https://example.com/lemon',
			title: 'lemon chicken',
		})

		server.popular.mockResolvedValue({ warming: true, results: [chosen] })
		server.import.mockResolvedValue({ id: 'shared-1', title: chosen.title })
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', chosen.title, { userId: null }),
			ingredients: ['1 lemon'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})
		const { screen, queryClient } = await openBox()
		await screen.getByRole('option', { name: /lemon chicken/ }).click()
		await expect
			.element(screen.getByRole('table', { name: 'ingredients' }))
			.toHaveTextContent('1 lemon')
		queryClient.setQueryData(['popular-recipes'], {
			warming: false,
			results: [
				found({ recipeId: 'other', title: 'different recipe' }),
				found({ ...chosen, recipeId: 'shared-1' }),
			],
		})
		await expect
			.element(screen.getByRole('heading', { name: 'lemon chicken' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: 'different recipe' }))
			.not.toBeInTheDocument()
	})

	test.each([
		'too many imports — wait a minute and try again',
		'too many imports in flight — try again in a moment',
	])(
		'keeps Open available after a temporary preview failure: %s',
		async (message) => {
			server.search.mockResolvedValue({
				warming: false,
				results: [
					found({ url: 'https://example.com/lemon', title: 'lemon chicken' }),
				],
			})
			server.import
				.mockRejectedValueOnce(new Error(message))
				.mockResolvedValue({ id: 'shared-1', title: 'lemon chicken' })
			const { screen, input, router } = await openBox()
			await input.fill('lemon')
			await screen.getByRole('option', { name: /lemon chicken/ }).click()
			await expect.element(screen.getByRole('alert')).toHaveTextContent(message)
			await screen.getByRole('button', { name: 'open recipe' }).click()
			await expect
				.poll(() => router.state.location.pathname)
				.toBe('/recipes/shared-1')
			expect(server.import).toHaveBeenCalledTimes(2)
		},
	)

	test('replaces failed preview actions with a link to the source', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/roundup', title: 'lemon ideas' }),
			],
		})
		const { screen, input } = await openBox()
		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon ideas/ }).click()
		await expect
			.element(screen.getByRole('link', { name: /see the page/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: /start from this/ }))
			.not.toBeInTheDocument()
	})

	test('offers to write a recipe it cannot find', async () => {
		const { screen, router, input } = await openBox()

		await input.fill('ramen')
		await expect
			.element(screen.getByRole('option', { name: /write “ramen”/ }))
			.toBeVisible()
		await screen.getByRole('option', { name: /write “ramen”/ }).hover()
		await userEvent.keyboard('{Enter}')
		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
		expect(router.state.location.search).toEqual({ title: 'ramen' })
	})

	test('imports a pasted link with enter and opens it', async () => {
		server.import.mockResolvedValue({ id: dal.id, title: 'dal' })

		const { screen, router, input } = await openBox()

		await input.fill('https://example.com/dal')
		await expect
			.element(screen.getByRole('option', { name: /import this recipe/ }))
			.toBeVisible()
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-2')
		expect(server.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/dal', keep: true },
		})
		expect(server.search).not.toHaveBeenCalled()
	})

	test('brings in a recipe-site page on pick, and says when it fails', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/ramen', title: 'online ramen' }),
			],
		})

		const { screen, input } = await openBox()

		await input.fill('ramen')
		await expect
			.element(screen.getByRole('option', { name: /online ramen/ }))
			.toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('link', { name: /see the page/ }))
			.toBeVisible()
		expect(server.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/ramen', keep: false },
		})
	})

	test('shows the stars a site page gave once its preview reads it', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/ramen', title: 'online ramen' }),
			],
		})
		server.import.mockResolvedValue({
			id: 'shared-ramen',
			title: 'online ramen',
			ratingValue: 4.7,
			ratingCount: 312,
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-ramen', 'online ramen', { userId: null }),
			ingredients: ['ramen noodles'],
			steps: ['boil'],
			saved: false,
			owned: false,
		})

		const { screen, input } = await openBox()

		await input.fill('ramen')

		const row = screen.getByRole('option', { name: /online ramen/ })

		// The index knows only its title, so there are no stars yet.
		await expect.element(row).toHaveAttribute('aria-selected', 'true')
		expect(row.getByLabelText(/^rated/).all()).toHaveLength(0)

		await row.hover()
		await expect.element(row.getByLabelText('rated 4.7 by 312')).toBeVisible()
	})

	test('keeps the highlighted option when results arrive after it', async () => {
		let arrive: (value: SearchReply) => void = () => {}

		shelfState.recipes = [shelfRecipe('recipe-ramen', 'shoyu ramen')]
		server.search.mockReturnValue(new Promise((resolve) => (arrive = resolve)))

		const { screen, input } = await openBox()

		await input.fill('ramen')

		const mine = screen.getByRole('option', { name: /shoyu ramen/ })

		await mine.hover()
		await expect.element(mine).toHaveAttribute('aria-selected', 'true')

		arrive({
			warming: false,
			results: [
				found({ recipeId: 'recipe-ramen', title: 'shoyu ramen', saved: true }),
				found({ url: 'https://example.com/ramen', title: 'online ramen' }),
			],
		})

		await expect
			.element(screen.getByRole('option', { name: /online ramen/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /shoyu ramen/ }))
			.toHaveAttribute('aria-selected', 'true')
	})

	test('ignores other picks while one is under way', async () => {
		shelfState.recipes = [dal]
		server.import.mockReturnValue(new Promise(() => {}))
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: dal.id, title: 'dal', saved: true }),
				found({ url: 'https://example.com/dal', title: 'online dal' }),
			],
		})

		const { screen, router, input } = await openBox()

		await input.fill('dal')
		await screen.getByRole('option', { name: /online dal/ }).hover()
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'back to results' }))
			.toBeVisible()
		await userEvent.keyboard('{ArrowUp}{Enter}')

		expect(router.state.location.pathname).toBe('/recipes')
	})

	test('sends a whole pasted recipe to a new page to sort', async () => {
		const { screen, router, input } = await openBox()

		const data = new DataTransfer()
		data.setData(
			'text',
			'weeknight dal\ningredients\n1 cup lentils\nmethod\n1. simmer',
		)
		input.element().dispatchEvent(
			new ClipboardEvent('paste', {
				clipboardData: data,
				bubbles: true,
				cancelable: true,
			}),
		)

		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
		await expect
			.element(screen.getByRole('textbox', { name: 'name', exact: true }))
			.toHaveValue('weeknight dal')
	})

	test('imports a bare link pasted as recipe text', async () => {
		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'add recipe' }).click()
		await screen.getByRole('menuitem', { name: 'paste text' }).click()

		const dialog = screen.getByRole('dialog', { name: 'paste a recipe' })
		await dialog
			.getByRole('textbox', { name: 'recipe text' })
			.fill('example.com/dal')
		await dialog.getByRole('button', { name: 'add recipe' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'recipe link' }))
			.toHaveValue('https://example.com/dal')
		expect(router.state.location.pathname).toBe('/recipes')
	})

	test('imports a link from the add menu', async () => {
		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'add recipe' }).click()
		await screen.getByRole('menuitem', { name: 'import url' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'recipe link' }))
			.toHaveFocus()
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('dialog', { name: 'import a recipe' }))
			.not.toBeInTheDocument()
	})
})

// The finder popup alone, in each state it can show.
describe('the one box, captured', () => {
	beforeEach(() => {
		shelfState.recipes = []
		server.search.mockReset().mockResolvedValue({ warming: false, results: [] })
		server.popular
			.mockReset()
			.mockResolvedValue({ warming: false, results: [] })
		server.import
			.mockReset()
			.mockRejectedValue(new Error('Import failed. Please retry.'))
		server.save.mockReset().mockResolvedValue({})
		server.getRecipe.mockReset().mockResolvedValue(null)
	})

	test('before anything is typed', async () => {
		shelfState.recipes = [
			shelfRecipe('draft-1', 'shakshuka', { finalizedAt: null }),
			miso,
		]
		server.popular.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'marry me chicken' })],
		})

		const { screen, popup } = await openBox()

		await expect
			.element(screen.getByRole('option', { name: /marry me chicken/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder')
	})

	test('with shelf and online results', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: miso.id, title: miso.title, saved: true }),
				found({
					recipeId: 'shared-1',
					title: 'lemon pasta',
					ingredientMatches: ['pasta'],
					rating: { value: 4.86, count: 1204 },
				}),
				found({
					title: 'pasta e fagioli',
					url: 'https://www.bbcgoodfood.com/recipes/pasta-e-fagioli',
					siteName: 'BBC Good Food',
					rating: { value: 4, count: 87 },
				}),
			],
		})

		server.getRecipe.mockResolvedValue({
			...miso,
			ingredients: ['200g spaghetti', '2 tbsp white miso', '3 tbsp butter'],
			steps: ['boil', 'toss'],
			saved: true,
			owned: true,
		})

		const { screen, input, popup } = await openBox()

		await input.fill('pasta')
		await expect
			.element(screen.getByRole('option', { name: /pasta e fagioli/ }))
			.toBeVisible()

		if (!isPhone())
			await expect.element(screen.getByText('2 tbsp white miso')).toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-results')
	})

	test('while it looks online', async () => {
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, input, popup } = await openBox()

		await input.fill('ramen')
		await expect.element(screen.getByText('looking for recipes…')).toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-searching')
	})

	test('when nothing is found', async () => {
		const { screen, input, popup } = await openBox()

		await input.fill('ramen')
		await expect
			.element(screen.getByText('no recipes called that yet'))
			.toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-nothing-found')
	})

	test('when the search fails', async () => {
		server.search.mockRejectedValue(new Error('down'))

		const { screen, input, popup } = await openBox()

		await input.fill('ramen')
		await expect
			.element(screen.getByText("couldn't search recipes — try again"))
			.toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-search-failed')
	})

	test('with a pasted link', async () => {
		const { screen, input, popup } = await openBox()

		await input.fill('https://example.com/dal')
		await expect
			.element(screen.getByRole('option', { name: /import this recipe/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-link')
	})

	test('previewing a recipe', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
			ingredients: ['6 chicken thighs', '1 lemon'],
			steps: ['roast'],
			saved: false,
			owned: false,
		})

		const { screen, input, popup } = await openBox()

		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon chicken/ }).click()
		await expect.element(screen.getByText('6 chicken thighs')).toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-preview')
	})

	test('previewing a page it could not read', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/roundup', title: 'lemon ideas' }),
			],
		})

		const { screen, input, popup } = await openBox()

		await input.fill('lemon')
		await screen.getByRole('option', { name: /lemon ideas/ }).click()
		await expect
			.element(screen.getByRole('link', { name: /see the page/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(popup, 'finder-preview-failed')
	})
})
