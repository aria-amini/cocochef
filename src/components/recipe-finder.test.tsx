import { renderRoute } from '@tests/support/render/route'
import { expectIsolatedScreenshot } from '@tests/support/screenshot'
import { isPhone, phoneOnly } from '@tests/support/viewport'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import type { FoundRecipe } from '@/lib/discover/server'
import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

const shelfState = vi.hoisted<{ recipes: Recipe[] }>(() => ({ recipes: [] }))

const server = vi.hoisted(() => ({
	search: vi.fn(),
	popular: vi.fn(),
	import: vi.fn(),
	save: vi.fn(),
	remove: vi.fn(),
	getRecipe: vi.fn(),
	peek: vi.fn(),
}))

vi.mock('@/lib/home/server', () => ({
	homeNow: async () => ({
		signedIn: true,
		cooking: null,
		shopping: null,
		waiting: 0,
	}),
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

// What the reader's kitchen holds, for the preview's have and need.
type KitchenItem = {
	name: string
	level: 'plenty' | 'low' | 'out'
	stale: boolean
	confirmedAt: Date
	spoils: boolean
	daysLeft: number
}

const kitchen = vi.hoisted<{ items: KitchenItem[] }>(() => ({ items: [] }))

vi.mock('@/lib/pantry/server', async (importOriginal) => ({
	...(await importOriginal<object>()),
	pantryOnHand: async () => kitchen.items,
}))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: server.search,
	popularRecipes: server.popular,
}))

vi.mock('@/lib/import/server', () => ({
	importRecipe: server.import,
	peekRecipes: server.peek,
}))

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	// The recipe page a search opens, and the editor the box starts a recipe
	// in, need the rest, which they never call here.
	...(await importOriginal<object>()),
	removeSavedRecipe: server.remove,
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
		prepMinutes: null,
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

// A result row, by the name it shows. Its name for a screen reader starts
// with the row's own buttons, so it is found by its text.
const rowOf = (title: string) =>
	page
		.getByRole('option')
		.filter({ has: page.getByText(title, { exact: true }) })

// Searching is home's, asked for with the search's words in the address.
async function openSearch() {
	const rendered = await renderRoute({ path: '/?q=', session: testSession })
	const input = rendered.screen.getByRole('combobox', { name: 'find a recipe' })

	await expect.element(input).toHaveFocus()

	const panel = rendered.screen.getByRole('region', { name: 'find a recipe' })

	return { ...rendered, input, panel }
}

// The box opens over the editor, holding the name written so far, to pick a
// recipe to start the new one from.
async function openStartFrom(name = 'lemon') {
	const rendered = await renderRoute({
		path: '/recipes/new',
		session: testSession,
	})

	const title = rendered.screen.getByRole('textbox', {
		name: 'name',
		exact: true,
	})

	// The editor loads on first visit, which can be slow when cold.
	await expect.element(title, { timeout: 10_000 }).toBeVisible()
	await title.fill(name)
	await rendered.screen
		.getByRole('button', { name: /start from a recipe like/ })
		.click()

	const box = page.getByRole('dialog', { name: 'find a recipe' })
	const input = box.getByRole('combobox', { name: 'find a recipe' })

	await expect.element(input).toHaveValue(name)

	return { ...rendered, box, input }
}

// One kind of filter, opened in the panel behind the filter button: the kinds
// are down its left, and the one chosen has its boxes on the right.
async function openFilter(
	screen: Awaited<ReturnType<typeof openSearch>>['screen'],
	kind: string,
) {
	const panel = page.getByRole('dialog', { name: 'filters' })

	if (!panel.query())
		await screen.getByRole('button', { name: /^filter/ }).click()
	await panel.getByRole('button', { name: new RegExp(`^${kind}`) }).click()

	return panel
}

function resetServer() {
	shelfState.recipes = []
	server.search.mockReset().mockResolvedValue({ warming: false, results: [] })
	server.popular.mockReset().mockResolvedValue({ warming: false, results: [] })
	server.import
		.mockReset()
		.mockRejectedValue(new Error('Import failed. Please retry.'))
	server.save.mockReset().mockResolvedValue({})
	server.remove.mockReset().mockResolvedValue(null)
	server.getRecipe.mockReset().mockResolvedValue(null)
	server.peek.mockReset().mockResolvedValue([])
	kitchen.items = []
}

describe('the search on home', () => {
	beforeEach(resetServer)

	test('shows only popular recipes before anything is typed', async () => {
		shelfState.recipes = [
			shelfRecipe('draft-1', 'shakshuka', { finalizedAt: null }),
			miso,
		]
		server.popular.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'marry me chicken' })],
		})

		const { screen } = await openSearch()

		// The shelf has a page of its own; an empty search browses others'.
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

	test('goes on as the list is scrolled, then reveals more a page at a time', async () => {
		server.popular.mockResolvedValue({
			warming: false,
			results: Array.from({ length: 75 }, (_, i) =>
				found({
					title: `stew ${i + 1}`,
					url: `https://example.com/stew-${i + 1}`,
				}),
			),
		})

		const { screen } = await openSearch()

		const shown = () =>
			screen.getByRole('option', { name: /stew \d+/ }).elements().length

		const more = screen.getByRole('button', { name: 'show more recipes' })

		await expect.poll(shown).toBe(12)
		await expect.element(more).not.toBeInTheDocument()

		// Scrolled to its end, the list goes on by itself, for a while.
		await expect
			.poll(
				() => {
					screen.getByText('more recipes…').query()?.scrollIntoView()

					return shown()
				},
				{ timeout: 15_000 },
			)
			.toBe(60)

		// Then going on is a choice.
		await more.click()
		await expect.poll(shown).toBe(72)
		await more.click()
		await expect.poll(shown).toBe(75)
		await expect.element(more).not.toBeInTheDocument()
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

		const { screen, input } = await openSearch()

		const row = (name: RegExp) => screen.getByRole('option', { name })

		await input.fill('kimchi')
		await expect.element(row(/quick kimchi/)).toBeVisible()
		expect(row(/quick kimchi/).element().textContent).toContain(
			'bbcgoodfood.com',
		)

		// Made your own: no site, and no text in its place. Unrated, its stars
		// are a dashed placeholder.
		await input.fill('dal')
		await expect.element(rowOf('dal')).toBeVisible()
		await expect
			.element(rowOf('dal').getByLabelText('not rated yet'))
			.toBeVisible()
		expect(rowOf('dal').element().textContent).toBe('dal0.00 votes')
	})

	test('finds shelf recipes by name at once and opens one with enter', async () => {
		shelfState.recipes = [miso, dal]
		// The server is slow; names on the shelf match without it.
		server.search.mockReturnValue(new Promise(() => {}))
		server.getRecipe.mockResolvedValue({
			...miso,
			ingredients: ['200 g pasta'],
			steps: ['boil'],
			saved: true,
			owned: true,
		})

		const { screen, router, input } = await openSearch()

		await input.fill('mis')
		// A list alone has no heading over it.
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toHaveAttribute('aria-selected', 'true')
		await expect
			.element(screen.getByText('on your shelf'))
			.not.toBeInTheDocument()
		await expect.element(rowOf('dal')).not.toBeInTheDocument()
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-1')

		// The recipe's way back is to the search it came from.
		await screen.getByRole('button', { name: 'back to results' }).click()
		await expect.poll(() => router.state.location.pathname).toBe('/')
		// The search comes back with its words.
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveValue('mis')
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toBeVisible()
	})

	test('moves through recipes with the keyboard', async () => {
		shelfState.recipes = [miso, dal]
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, router, input } = await openSearch()

		await input.fill('a')
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{ArrowDown}')
		await expect.element(rowOf('dal')).toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-2')
	})

	test('opens a recipe on a tap, not on hover, without saving it', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		const { screen, router, input } = await openSearch()

		await input.fill('lemon')

		const option = screen.getByRole('option', { name: /lemon chicken/ })

		await option.hover()
		await expect.element(option).toHaveAttribute('aria-selected', 'true')
		expect(router.state.location.pathname).toBe('/')
		await option.click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/shared-1')
		expect(router.state.location.state.foundBy).toBe('lemon')
		expect(server.save).not.toHaveBeenCalled()
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

		const { screen, input } = await openSearch()

		await input.fill('lemon thighs')
		await expect
			.element(screen.getByRole('option', { name: /has lemon, thighs/ }))
			.toBeVisible()
		await expect.element(screen.getByText('more recipes')).toBeVisible()
		expect(server.search).toHaveBeenCalledWith({ data: { q: 'lemon thighs' } })
	})

	test('shows how found recipes were rated', async () => {
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

		const { screen, input } = await openSearch()

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
	})

	test('sorts by rating, from everywhere, without a search', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					recipeId: 'shared-1',
					title: 'lemon chicken',
					rating: { value: 4.86, count: 1204 },
				}),
			],
		})

		const { screen } = await openSearch()

		// The sort sits at the far end of the filter bar, after the filters.
		const filter = screen.getByRole('button', { name: /^filter/ })
		const sort = screen.getByRole('button', { name: 'sort by' })

		expect(sort.element().getBoundingClientRect().left).toBeGreaterThan(
			filter.element().getBoundingClientRect().left,
		)
		await sort.click()
		await page.getByRole('menuitem', { name: 'rating' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'sort by rating' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /lemon chicken/ }))
			.toBeVisible()
		expect(server.search).toHaveBeenLastCalledWith({
			data: { q: '', sort: 'loved' },
		})

		// Put back, the list is what it was.
		await screen.getByRole('button', { name: 'stop sorting' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'sort by', exact: true }))
			.toBeVisible()
	})

	test('sorts by the recipes most voted on, from everywhere', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					recipeId: 'shared-1',
					title: 'lemon chicken',
					rating: { value: 4.2, count: 9120 },
				}),
			],
		})

		const { screen } = await openSearch()

		await screen.getByRole('button', { name: 'sort by' }).click()
		await page.getByRole('menuitem', { name: 'votes' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'sort by votes' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /lemon chicken/ }))
			.toBeVisible()
		expect(server.search).toHaveBeenLastCalledWith({
			data: { q: '', sort: 'votes' },
		})
	})

	test('says how a recipe was rated, where it is from, and what it is built on', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					recipeId: 'shared-1',
					title: 'Galbi Jjim',
					rating: { value: 4.5, count: 349 },
					totalMinutes: 150,
					tags: {
						cuisines: ['east asian', 'korean'],
						flavors: [],
						proteins: ['beef'],
						forms: [],
					},
				}),
			],
		})

		const { screen, router, input } = await openSearch()

		await input.fill('galbi')

		const row = screen.getByRole('option', { name: /galbi jjim/i })

		// Its name, as the list writes every name; its stars with the votes
		// under them; the site it is from; and its tags.
		await expect
			.element(row.getByText('Galbi Jjim', { exact: true }))
			.toBeVisible()
		await expect.element(row.getByLabelText('rated 4.5 by 349')).toBeVisible()
		await expect.element(row.getByText('349 votes')).toBeVisible()
		await expect
			.element(row.getByText('Example', { exact: true }))
			.toBeVisible()
		await expect.element(row.getByText('korean')).toBeVisible()
		await expect.element(row.getByText('beef')).toBeVisible()
		// The list leaves time and shopping to the recipe's page.
		expect(row.element().textContent).not.toContain('to make')
		expect(row.element().textContent).not.toContain('buy')
		expect(router.state.location.pathname).toBe('/')
		await expectIsolatedScreenshot(row, 'finder-row')
	})

	test('tags a row by what matters most, leaving out the usual entree', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					recipeId: 'shared-1',
					title: 'chocolate cake',
					tags: {
						cuisines: ['french'],
						flavors: [],
						proteins: [],
						forms: [],
					},
					effort: {
						waits: [],
						dayBefore: false,
						keeps: { days: '3–4 days', freezes: false },
						foods: 4,
						vegetarian: true,
						vegan: false,
					},
				}),
				found({
					recipeId: 'shared-2',
					title: 'beef stew',
					tags: {
						cuisines: [],
						flavors: [],
						proteins: ['beef'],
						forms: [],
					},
				}),
			],
		})

		const { screen, input } = await openSearch()

		await input.fill('dinner')

		const cake = screen.getByRole('option', { name: /chocolate cake/ })
		const stew = screen.getByRole('option', { name: /beef stew/ })

		// Meat-free is marked, and so is where it is from.
		await expect.element(cake.getByText('vegetarian')).toBeVisible()
		await expect.element(cake.getByText('french')).toBeVisible()
		// The usual dish is not worth saying.
		await expect.element(stew.getByText('entree')).not.toBeInTheDocument()
		await expect.element(stew.getByText('beef')).toBeVisible()

		// A phone's row keeps the two tags that say the most; the kind of dish
		// waits for room.
		if (isPhone())
			await expect.element(cake.getByText('dessert')).not.toBeVisible()
		else await expect.element(cake.getByText('dessert')).toBeVisible()
	})

	test('saves a recipe from its row, and takes it back off', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-1', title: 'lemon chicken' }),
				found({ url: 'https://example.com/dal', title: 'tadka dal' }),
			],
		})
		server.save.mockResolvedValue({ id: 'shared-1' })
		server.import.mockResolvedValue({ id: 'shared-2', title: 'tadka dal' })

		const { screen, router, input } = await openSearch()

		await input.fill('lemon')

		const save = (title: string) =>
			screen.getByRole('button', { name: `save ${title}`, exact: true })

		const unsave = (title: string) =>
			screen.getByRole('button', { name: `unsave ${title}`, exact: true })

		await expect
			.element(save('lemon chicken'))
			.toHaveAttribute('aria-pressed', 'false')
		await save('lemon chicken').click()
		await expect
			.element(unsave('lemon chicken'))
			.toHaveAttribute('aria-pressed', 'true')
		expect(server.save).toHaveBeenCalledWith({ data: { id: 'shared-1' } })

		// Keeping it is not opening it.
		expect(router.state.location.pathname).toBe('/')

		await unsave('lemon chicken').click()
		await expect
			.element(save('lemon chicken'))
			.toHaveAttribute('aria-pressed', 'false')
		expect(server.remove).toHaveBeenCalledWith({ data: { id: 'shared-1' } })

		// A site page is brought in and kept in one go.
		await save('tadka dal').click()
		await expect
			.element(unsave('tadka dal'))
			.toHaveAttribute('aria-pressed', 'true')
		expect(server.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/dal', keep: true },
		})

		// Kept, it is known by its id, so it can be taken off again.
		await unsave('tadka dal').click()
		await expect
			.element(save('tadka dal'))
			.toHaveAttribute('aria-pressed', 'false')
		expect(server.remove).toHaveBeenLastCalledWith({ data: { id: 'shared-2' } })
	})

	test('asks a visitor to sign in before saving', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		const { screen } = await renderRoute({ path: '/?q=lemon' })

		await screen
			.getByRole('button', { name: 'save lemon chicken', exact: true })
			.click()
		await expect
			.element(page.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
		expect(server.save).not.toHaveBeenCalled()
	})

	test('reads the pages in view ahead of a tap, to show their stars', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/lemon-tart', title: 'lemon tart' }),
				found({ recipeId: 'shared-1', title: 'lemon chicken' }),
			],
		})
		server.peek.mockResolvedValue([
			{
				url: 'https://example.com/lemon-tart',
				id: 'shared-2',
				ratingValue: 4.7,
				ratingCount: 310,
			},
		])

		const { screen, input } = await openSearch()

		await input.fill('lemon')
		await expect
			.element(
				screen
					.getByRole('option', { name: /lemon tart/ })
					.getByLabelText('rated 4.7 by 310'),
			)
			.toBeVisible()
		// Only the page nobody has read yet goes, and only once.
		expect(server.peek).toHaveBeenCalledTimes(1)
		expect(server.peek).toHaveBeenCalledWith({
			data: { urls: ['https://example.com/lemon-tart'] },
		})
	})

	test('offers to write a recipe it cannot find', async () => {
		const { screen, router, input } = await openSearch()

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

		const { screen, router, input } = await openSearch()

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

		const { screen, router, input } = await openSearch()

		await input.fill('ramen')
		await expect
			.element(screen.getByRole('option', { name: /online ramen/ }))
			.toHaveAttribute('aria-selected', 'true')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('Import failed. Please retry.')
		expect(router.state.location.pathname).toBe('/')
		expect(server.import).toHaveBeenCalledWith({
			data: { url: 'https://example.com/ramen', keep: false },
		})

		// Read once it can be, the page opens as a recipe.
		server.import.mockResolvedValue({
			id: 'shared-ramen',
			title: 'online ramen',
		})
		await userEvent.keyboard('{Enter}')
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/shared-ramen')
	})

	test('narrows the results to the recipe sites picked', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({
					url: 'https://www.bbcgoodfood.com/recipes/lemon-chicken',
					title: 'lemon chicken',
					siteName: 'BBC Good Food',
				}),
				found({
					url: 'https://www.seriouseats.com/lemon-tart',
					title: 'lemon tart',
					siteName: 'Serious Eats',
				}),
				found({
					url: 'https://example.com/lemon-cake',
					title: 'lemon cake',
				}),
			],
		})

		const { screen, input } = await openSearch()

		await input.fill('lemon')
		await expect
			.element(screen.getByRole('option', { name: /lemon tart/ }))
			.toBeVisible()
		await openFilter(screen, 'site')
		await page.getByRole('checkbox', { name: 'BBC Good Food' }).click()
		await page.getByRole('checkbox', { name: 'Serious Eats' }).click()
		await userEvent.keyboard('{Escape}')

		// Any site picked will do.
		await expect
			.element(screen.getByRole('button', { name: /^site: / }))
			.toHaveTextContent('BBC Good Food +1')
		await expect
			.element(screen.getByRole('option', { name: /lemon chicken/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /lemon tart/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /lemon cake/ }))
			.not.toBeInTheDocument()

		// Cleared, every site is back.
		await screen.getByRole('button', { name: 'clear site' }).click()
		await expect
			.element(screen.getByRole('option', { name: /lemon cake/ }))
			.toBeVisible()
	})

	test('narrows to recipes with any of the proteins picked', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-1', title: 'lemon chicken' }),
				found({ recipeId: 'shared-2', title: 'pork chops' }),
				found({ recipeId: 'shared-3', title: 'beef stew' }),
			],
		})

		const { screen, input } = await openSearch()

		await input.fill('dinner')
		await expect
			.element(screen.getByRole('option', { name: /beef stew/ }))
			.toBeVisible()
		await openFilter(screen, 'protein')
		await page.getByRole('checkbox', { name: 'chicken' }).click()
		await page.getByRole('checkbox', { name: 'pork' }).click()
		await expect
			.element(page.getByRole('checkbox', { name: 'chicken' }))
			.toBeChecked()
		await userEvent.keyboard('{Escape}')

		await expect
			.element(screen.getByRole('button', { name: 'protein: chicken, pork' }))
			.toHaveTextContent('chicken +1')
		await expect
			.element(screen.getByRole('option', { name: /lemon chicken/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /pork chops/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /beef stew/ }))
			.not.toBeInTheDocument()
	})

	test("narrows to a region's countries when the region is ticked", async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-1', title: 'korean fried chicken' }),
				found({ recipeId: 'shared-2', title: 'japanese curry' }),
				found({ recipeId: 'shared-3', title: 'thai green curry' }),
			],
		})

		const { screen, input } = await openSearch()

		await input.fill('dinner')
		await expect
			.element(screen.getByRole('option', { name: /thai green curry/ }))
			.toBeVisible()
		await openFilter(screen, 'country')

		// Ticking a region takes every country in it.
		await page.getByRole('checkbox', { name: 'east asian' }).click()
		await expect
			.element(screen.getByRole('option', { name: /korean fried chicken/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /japanese curry/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /thai green curry/ }))
			.not.toBeInTheDocument()

		// Opened, its countries are each ticked; taking one off keeps the rest.
		await page
			.getByRole('button', { name: 'show east asian countries' })
			.click()
		// The most found countries are also listed on top, so one is found by
		// name to be sure of the one in its region.
		await page.getByRole('searchbox', { name: 'find a country' }).fill('korean')
		await expect
			.element(page.getByRole('checkbox', { name: 'korean' }))
			.toBeChecked()
		await page
			.getByRole('searchbox', { name: 'find a country' })
			.fill('japanese')
		await page.getByRole('checkbox', { name: 'japanese' }).click()
		await expect
			.element(page.getByRole('checkbox', { name: 'east asian' }))
			.toHaveAttribute('aria-checked', 'mixed')
		await userEvent.keyboard('{Escape}')

		// The region's other countries stay picked, found or not yet.
		await expect
			.element(screen.getByRole('button', { name: /^country: korean/ }))
			.toHaveTextContent('korean +5')
		await expect
			.element(screen.getByRole('option', { name: /korean fried chicken/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /japanese curry/ }))
			.not.toBeInTheDocument()
	})

	test('greys out what the picked site has none of, and says when filters hide everything', async () => {
		const curry = found({
			url: 'https://www.seriouseats.com/thai-green-curry',
			title: 'thai green curry',
			siteName: 'Serious Eats',
		})

		const chicken = found({
			url: 'https://www.bbcgoodfood.com/recipes/lemon-chicken',
			title: 'lemon chicken',
			siteName: 'BBC Good Food',
		})

		server.search.mockImplementation(
			async ({ data }: { data: { q: string } }) => ({
				warming: false,
				results: data.q === 'curry' ? [curry, chicken] : [chicken],
			}),
		)

		const { screen, input } = await openSearch()

		await input.fill('curry')
		await expect
			.element(screen.getByRole('option', { name: /thai green curry/ }))
			.toBeVisible()

		// On BBC Good Food alone, nothing is Thai, so Thai isn't offered.
		await openFilter(screen, 'site')
		await page.getByRole('checkbox', { name: 'BBC Good Food' }).click()
		await openFilter(screen, 'country')
		await expect
			.element(page.getByRole('checkbox', { name: 'southeast asian' }))
			.toBeDisabled()
		await userEvent.keyboard('{Escape}')
		await screen.getByRole('button', { name: 'clear site' }).click()

		await openFilter(screen, 'country')
		await page
			.getByRole('button', { name: 'show southeast asian countries' })
			.click()
		// Found by name, since the most found countries are listed on top too.
		await page.getByRole('searchbox', { name: 'find a country' }).fill('thai')
		await page.getByRole('checkbox', { name: 'thai' }).click()
		await userEvent.keyboard('{Escape}')

		// A search the Thai pick hides entirely isn't a name to write.
		await input.fill('lemon')
		await expect
			.element(screen.getByText('nothing here matches these filters'))
			.toBeVisible()
		expect(screen.getByRole('option', { name: /write/ }).all()).toHaveLength(0)
	})
	test('keeps the highlighted option when results arrive after it', async () => {
		let arrive: (value: SearchReply) => void = () => {}

		shelfState.recipes = [shelfRecipe('recipe-ramen', 'shoyu ramen')]
		server.search.mockReturnValue(new Promise((resolve) => (arrive = resolve)))

		const { screen, input } = await openSearch()

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

		const { screen, router, input } = await openSearch()

		await input.fill('dal')
		await screen.getByRole('option', { name: /online dal/ }).hover()
		await userEvent.keyboard('{Enter}')
		// The page is still being read, so no other row can be picked meanwhile.
		await expect
			.element(screen.getByRole('option', { name: /online dal/ }))
			.toHaveAttribute('aria-disabled', 'true')
		await userEvent.keyboard('{ArrowUp}{Enter}')

		expect(router.state.location.pathname).toBe('/')
		expect(server.getRecipe).not.toHaveBeenCalled()
	})

	test('sends a whole pasted recipe to a new page to sort', async () => {
		const { screen, router, input } = await openSearch()

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

// The box the editor opens to start a recipe from one found: the finder with
// a recipe looked at up close, beside the list or in its place.
describe('the box, starting from a recipe found', () => {
	beforeEach(resetServer)

	const lemonChicken = {
		...shelfRecipe('shared-1', 'lemon chicken', { userId: null }),
		ingredients: ['6 chicken thighs', '1 lemon'],
		steps: ['roast'],
		saved: false,
		owned: false,
	}

	test('lets a keyboard cover the box, and pads the list clear of it', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		const { box } = await openStartFrom()
		const popup = box.element()
		const height = () => Math.round(popup.getBoundingClientRect().height)
		const before = height()

		// Full screen on a phone; 2rem clear of the edges on a wide screen.
		expect(before).toBe(
			isPhone() ? window.innerHeight : window.innerHeight - 64,
		)

		// A keyboard covering 300px leaves the box as it was, and the list
		// ends that far lower, so its last rows can still scroll into view.
		document.documentElement.style.setProperty('--keyboard-inset', '300px')

		try {
			const list = box.getByRole('listbox').element().parentElement

			if (!list) throw new Error('no list')

			await expect
				.poll(() => getComputedStyle(list).paddingBottom)
				.toBe('300px')
			expect(height()).toBe(before)
		} finally {
			document.documentElement.style.removeProperty('--keyboard-inset')
		}
	})

	phoneOnly(
		'opens full screen on phones, square, with the bar at the top',
		async () => {
			server.search.mockResolvedValue({
				warming: false,
				results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
			})

			const { box, input } = await openStartFrom()
			const dialog = box.element()
			const edges = dialog.getBoundingClientRect()

			expect(edges.top).toBe(0)
			expect(edges.height).toBe(window.innerHeight)
			expect(getComputedStyle(dialog).borderTopLeftRadius).toBe('0px')
			await expect.element(input).toBeVisible()
			expect(
				input.element().getBoundingClientRect().top,
			).toBeGreaterThanOrEqual(0)
		},
	)

	test('keeps the search bar on screen while a recipe is previewed', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		const { box, input } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()
		await expect
			.element(box.getByRole('button', { name: 'back to results' }))
			.toBeVisible()
		await expect.element(input).toBeVisible()

		// Typing again leaves the preview for the new search.
		await input.fill('dal')
		await expect
			.element(box.getByRole('button', { name: 'back to results' }))
			.not.toBeInTheDocument()
	})

	test('keeps hover previews free of actions until a recipe is selected', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		server.getRecipe.mockResolvedValue(lemonChicken)

		const { box } = await openStartFrom()
		const option = box.getByRole('option', { name: /lemon chicken/ })
		const use = box.getByRole('button', { name: 'use this recipe' })

		await option.hover()

		// A wide screen shows the recipe beside the list.
		if (!isPhone())
			await expect.element(box.getByText('6 chicken thighs')).toBeVisible()
		await expect.element(use).not.toBeInTheDocument()
		await option.click()
		await expect.element(use).toBeVisible()

		// Picked here, a recipe is used, not saved or opened.
		await expect
			.element(box.getByRole('button', { name: 'save', exact: true }))
			.not.toBeInTheDocument()
		await expect
			.element(box.getByRole('button', { name: 'open recipe' }))
			.not.toBeInTheDocument()
	})

	test('selects a full-height preview, and goes back to the results', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		server.getRecipe.mockResolvedValue(lemonChicken)

		const { box, input } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()
		await expect.element(box.getByText('6 chicken thighs')).toBeVisible()

		// Its action sits under the title, as on the recipe's own page.
		const use = box.getByRole('button', { name: 'use this recipe' })
		await expect.element(use).toBeVisible()
		expect(use.element().getBoundingClientRect().top).toBeGreaterThan(
			box
				.getByRole('heading', { name: /lemon chicken/ })
				.element()
				.getBoundingClientRect().top,
		)
		expect(box.element().getBoundingClientRect().height).toBe(
			window.innerHeight - (isPhone() ? 0 : 64),
		)
		await expect.element(box.getByRole('listbox')).not.toBeInTheDocument()
		await expect.element(box.getByText('roast', { exact: true })).toBeVisible()

		await box.getByRole('button', { name: 'back to results' }).click()
		await expect
			.element(box.getByRole('option', { name: /lemon chicken/ }))
			.toBeVisible()
		await expect.element(input).toHaveValue('lemon')
		await expect.element(input).toHaveFocus()
	})

	test('reads a previewed recipe for the shop: what is home, by where it comes from', async () => {
		const now = new Date()

		kitchen.items = [
			{
				name: 'chicken thighs',
				level: 'plenty',
				stale: false,
				confirmedAt: now,
				spoils: true,
				daysLeft: 5,
			},
			{
				name: 'spinach',
				level: 'plenty',
				stale: false,
				confirmedAt: now,
				spoils: true,
				daysLeft: 1,
			},
		]
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ recipeId: 'shared-1', title: 'chicken & spinach skillet' }),
			],
		})
		server.getRecipe.mockResolvedValue({
			...shelfRecipe('shared-1', 'chicken & spinach skillet', { userId: null }),
			ingredients: [
				'1 lb chicken thighs',
				'4 cups spinach',
				'1 lemon',
				'1 tsp ground cumin',
			],
			steps: ['cook'],
			saved: false,
			owned: false,
		})

		const { box } = await openStartFrom('chicken')

		await box.getByRole('option', { name: /chicken & spinach skillet/ }).click()

		await expect
			.element(box.getByText('you have 2 of 4 · need 2'))
			.toBeVisible()
		await expect
			.element(box.getByText(/uses your spinach before it goes/))
			.toBeVisible()
		await expect
			.element(box.getByRole('region', { name: 'fresh' }).getByText('use soon'))
			.toBeVisible()
		await expect
			.element(
				box.getByRole('region', { name: 'spices' }).getByText(/cumin \(need\)/),
			)
			.toBeVisible()

		// As written, the recipe's own order.
		await box.getByRole('button', { name: 'as written' }).click()
		await expect
			.element(box.getByRole('region', { name: 'fresh' }))
			.not.toBeInTheDocument()
		await expect
			.element(box.getByRole('table', { name: 'ingredients' }))
			.toBeVisible()
	})

	test('keeps the focused action when the previewed recipe finishes loading', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})

		let load: (recipe: typeof lemonChicken) => void = () => {}

		server.getRecipe.mockReturnValue(new Promise((resolve) => (load = resolve)))

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()

		const use = box.getByRole('button', { name: 'use this recipe' })

		await expect.element(use).toBeVisible()
		use.element().focus()
		load(lemonChicken)
		await expect.element(box.getByText('6 chicken thighs')).toBeVisible()
		await expect.element(use).toHaveFocus()
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

		const { box } = await openStartFrom('ramen')

		await box.getByRole('option', { name: /online ramen/ }).click()

		const use = box.getByRole('button', { name: 'use this recipe' })

		await expect.element(use).toBeVisible()
		use.element().focus()
		bring({ id: 'shared-ramen', title: 'online ramen' })
		await expect.element(box.getByText('200 g ramen noodles')).toBeVisible()
		await expect.element(use).toHaveFocus()
	})

	test('says so when a previewed recipe can no longer be read', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'lemon chicken' })],
		})
		// A recipe made private after the results loaded comes back empty.
		server.getRecipe.mockResolvedValue(null)

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()
		await expect
			.element(box.getByRole('alert'))
			.toHaveTextContent("couldn't read this recipe — try opening it.")
	})

	test('keeps the selected preview when discovery refreshes a URL into a recipe ID', async () => {
		const chosen = found({
			url: 'https://example.com/lemon',
			title: 'lemon chicken',
		})

		// The search is still warming up, so it looks again.
		let reply: SearchReply = { warming: true, results: [chosen] }

		server.search.mockImplementation(async () => reply)
		server.import.mockResolvedValue({ id: 'shared-1', title: chosen.title })
		server.getRecipe.mockResolvedValue({
			...lemonChicken,
			ingredients: ['1 lemon'],
		})

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()
		await expect
			.element(box.getByRole('region', { name: 'fresh' }).getByText(/lemon/))
			.toBeVisible()

		// By the next look, the page is a recipe, with another found ahead.
		reply = {
			warming: false,
			results: [
				found({ recipeId: 'other', title: 'different recipe' }),
				found({ ...chosen, recipeId: 'shared-1' }),
			],
		}
		await expect
			.poll(() => box.element().textContent, { timeout: 6000 })
			.toContain('different recipe')
		await expect
			.element(box.getByRole('heading', { name: 'lemon chicken' }))
			.toBeVisible()
		await expect
			.element(box.getByRole('heading', { name: 'different recipe' }))
			.not.toBeInTheDocument()
	})

	test.each([
		'too many imports — wait a minute and try again',
		'too many imports in flight — try again in a moment',
	])(
		'keeps the recipe usable after a temporary preview failure: %s',
		async (message) => {
			server.search.mockResolvedValue({
				warming: false,
				results: [
					found({ url: 'https://example.com/lemon', title: 'lemon chicken' }),
				],
			})
			server.import.mockRejectedValue(new Error(message))
			server.getRecipe.mockResolvedValue(lemonChicken)

			const { box, screen } = await openStartFrom()

			await box.getByRole('option', { name: /lemon chicken/ }).click()
			await expect.element(box.getByRole('alert')).toHaveTextContent(message)

			// Once the limit has passed, using it reads the page again.
			server.import.mockResolvedValue({
				id: 'shared-1',
				title: 'lemon chicken',
			})
			await box.getByRole('button', { name: 'use this recipe' }).click()
			await expect.element(box).not.toBeInTheDocument()
			await expect
				.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
				.toHaveValue('6 chicken thighs')
			expect(server.import).toHaveBeenLastCalledWith({
				data: { url: 'https://example.com/lemon', keep: false },
			})
		},
	)

	test('replaces failed preview actions with a link to the source', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/roundup', title: 'lemon ideas' }),
			],
		})

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon ideas/ }).click()
		await expect
			.element(box.getByRole('link', { name: /see the page/ }))
			.toBeVisible()
		await expect
			.element(box.getByRole('button', { name: 'use this recipe' }))
			.not.toBeInTheDocument()
	})
})

// The search on home, and the box, alone, in each state they can show.
describe('the search, captured', () => {
	beforeEach(resetServer)

	test('before anything is typed', async () => {
		shelfState.recipes = [
			shelfRecipe('draft-1', 'shakshuka', { finalizedAt: null }),
			miso,
		]
		server.popular.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'marry me chicken' })],
		})

		const { screen, panel } = await openSearch()

		await expect
			.element(screen.getByRole('option', { name: /marry me chicken/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder')
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

		const { screen, input, panel } = await openSearch()

		await input.fill('pasta')
		await expect
			.element(screen.getByRole('option', { name: /pasta e fagioli/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder-results')
	})

	test('while it looks online', async () => {
		server.search.mockReturnValue(new Promise(() => {}))

		const { screen, input, panel } = await openSearch()

		await input.fill('ramen')
		await expect.element(screen.getByText('looking for recipes…')).toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder-searching')
	})

	test('when nothing is found', async () => {
		const { screen, input, panel } = await openSearch()

		await input.fill('ramen')
		await expect
			.element(screen.getByText('no recipes called that yet'))
			.toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder-nothing-found')
	})

	test('when the search fails', async () => {
		server.search.mockRejectedValue(new Error('down'))

		const { screen, input, panel } = await openSearch()

		await input.fill('ramen')
		await expect
			.element(screen.getByText("couldn't search recipes — try again"))
			.toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder-search-failed')
	})

	test('with a pasted link', async () => {
		const { screen, input, panel } = await openSearch()

		await input.fill('https://example.com/dal')
		await expect
			.element(screen.getByRole('option', { name: /import this recipe/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(panel, 'finder-link')
	})

	test('previewing a recipe in the box', async () => {
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

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon chicken/ }).click()
		await expect.element(box.getByText('6 chicken thighs')).toBeVisible()
		await expectIsolatedScreenshot(box, 'finder-preview')
	})

	test('previewing a page it could not read', async () => {
		server.search.mockResolvedValue({
			warming: false,
			results: [
				found({ url: 'https://example.com/roundup', title: 'lemon ideas' }),
			],
		})

		const { box } = await openStartFrom()

		await box.getByRole('option', { name: /lemon ideas/ }).click()
		await expect
			.element(box.getByRole('link', { name: /see the page/ }))
			.toBeVisible()
		await expectIsolatedScreenshot(box, 'finder-preview-failed')
	})
})
