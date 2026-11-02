import { renderRoute } from '@tests/support/render/route'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { FoundRecipe } from '@/lib/discover/server'
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

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: server.search,
	popularRecipes: server.popular,
}))

vi.mock('@/lib/import/server', () => ({ importRecipe: server.import }))

vi.mock('@/lib/recipes/server', () => ({
	listShelf: () =>
		Promise.resolve({ recipes: shelfState.recipes, collections: [] }),
	getRecipe: server.getRecipe,
	saveRecipe: server.save,
	listBooks: () => Promise.resolve([]),
	createRecipe: () => Promise.resolve({ id: 'recipe-new' }),
	updateRecipe: () => Promise.resolve({ id: 'recipe-new' }),
	deleteRecipe: () => Promise.resolve(),
	moveRecipe: () => Promise.resolve(),
}))

const testSession = {
	user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
	session: { id: 'session-1', token: 'token' },
}

type SearchReply = { warming: boolean; results: FoundRecipe[] }

const isPhone = () => window.innerWidth < 768

function shelfRecipe(id: string, title: string, extra: Partial<Recipe> = {}) {
	return {
		id,
		userId: 'user-1',
		collectionId: null,
		title,
		imageUrl: null,
		sourceUrl: null,
		servings: null,
		totalMinutes: null,
		notes: null,
		createdAt: new Date(),
		finalizedAt: new Date(),
		cookCount: 0,
		lastCookedAt: null,
		forkedFromId: null,
		savedAt: new Date(),
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

	await rendered.screen.getByRole('button', { name: /find a recipe/ }).click()
	const input = rendered.screen.getByRole('combobox', { name: 'find a recipe' })

	await expect.element(input).toHaveFocus()

	return { ...rendered, input }
}

describe('the one box', () => {
	beforeEach(() => {
		toast.dismiss()
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

	test('lays out every way to start before anything is typed', async () => {
		shelfState.recipes = [
			shelfRecipe('draft-1', 'shakshuka', { finalizedAt: null }),
			miso,
		]
		server.popular.mockResolvedValue({
			warming: false,
			results: [found({ recipeId: 'shared-1', title: 'marry me chicken' })],
		})

		const { screen } = await openBox()

		for (const name of [/blank recipe/, /import link/, /paste text/])
			await expect.element(screen.getByRole('option', { name })).toBeVisible()

		await expect
			.element(screen.getByText('start', { exact: true }))
			.not.toBeInTheDocument()
		await expect.element(screen.getByText('still writing')).toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /shakshuka/ }))
			.toBeVisible()
		await expect
			.element(screen.getByText('on your shelf').first())
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /miso butter pasta/ }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('option', { name: /marry me chicken/ }))
			.toBeVisible()
	})

	test('opens a paste dialog and returns to the finder on cancel', async () => {
		const { screen } = await openBox()
		await screen.getByRole('option', { name: /paste text/ }).click()
		const dialog = screen.getByRole('dialog', { name: 'Paste a recipe' })
		await expect.element(dialog).toBeVisible()
		await dialog.getByRole('textbox', { name: 'recipe text' }).fill('Pasta')
		await dialog.getByRole('button', { name: 'cancel' }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toBeVisible()
	})

	test('adds pasted text from the finder dialog', async () => {
		const { screen, router } = await openBox()
		await screen.getByRole('option', { name: /paste text/ }).click()
		const dialog = screen.getByRole('dialog', { name: 'Paste a recipe' })
		await dialog
			.getByRole('textbox', { name: 'recipe text' })
			.fill('weeknight dal\ningredients\n1 cup lentils\nmethod\n1. simmer')
		await dialog.getByRole('button', { name: 'add recipe' }).click()
		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
		await expect
			.element(screen.getByRole('textbox', { name: 'name', exact: true }))
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
		await screen.getByRole('button', { name: 'open recipe' }).click()
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-1')
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
			.element(screen.getByRole('button', { name: /save to shelf/ }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'open recipe' }))
			.not.toBeInTheDocument()
		await option.click()
		await expect
			.element(screen.getByRole('button', { name: /save to shelf/ }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'open recipe' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'start from this' }))
			.not.toBeInTheDocument()
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
		const add = screen.getByRole('button', { name: 'open recipe' })
		await expect.element(add).toBeVisible()
		const bar = add.element().parentElement

		if (!bar) throw new Error('missing preview actions')
		expect(getComputedStyle(bar).flexShrink).toBe('0')
		expect(add.element().getBoundingClientRect().top).toBeGreaterThan(
			screen
				.getByRole('heading', { name: /lemon chicken/ })
				.element()
				.getBoundingClientRect().top,
		)

		const ingredients = screen
			.getByRole('list', { name: 'ingredients' })
			.element()

		expect(ingredients.querySelectorAll('img')).toHaveLength(0)
		const dialog = document.querySelector('[role="dialog"]')

		if (!dialog) throw new Error('missing finder dialog')
		expect(dialog.getBoundingClientRect().height).toBe(
			window.innerHeight - (isPhone() ? 0 : 64),
		)
		await expect
			.element(screen.getByRole('button', { name: /save to shelf/ }))
			.not.toBeInTheDocument()

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
			.element(screen.getByRole('list', { name: 'ingredients' }))
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
			.element(screen.getByRole('button', { name: /save to shelf/ }))
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

	test('keeps the highlighted option when results arrive after it', async () => {
		let arrive: (value: SearchReply) => void = () => {}

		server.search.mockReturnValue(new Promise((resolve) => (arrive = resolve)))

		const { screen, router, input } = await openBox()

		await input.fill('ramen')
		await screen.getByRole('option', { name: /write/ }).hover()

		arrive({
			warming: false,
			results: [
				found({ url: 'https://example.com/ramen', title: 'online ramen' }),
			],
		})

		await expect
			.element(screen.getByRole('option', { name: /online ramen/ }))
			.toBeVisible()
		await userEvent.keyboard('{Enter}')
		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
		expect(server.import).not.toHaveBeenCalled()
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

	test('layers import over the finder and restores its search on close', async () => {
		const { screen, input } = await openBox()
		await screen.getByRole('option', { name: /import link/ }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'recipe link' }))
			.toHaveFocus()
		await expect
			.element(screen.getByRole('dialog', { name: 'import a recipe' }))
			.toBeVisible()
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('dialog', { name: 'find a recipe' }))
			.toBeVisible()
		await input.fill('lemon')
		await expect.element(input).toHaveValue('lemon')
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('dialog', { name: 'find a recipe' }))
			.not.toBeInTheDocument()
	})
})
