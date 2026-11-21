import { renderRoute } from '@tests/support/render/route'
import { expectPageScreenshot } from '@tests/support/screenshot'
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from 'vite-plus/test'

import type { homeNow } from '@/lib/home/server'

type Now = Awaited<ReturnType<typeof homeNow>>

const home = vi.hoisted(() => ({
	now: vi.fn(),
	inProgress: vi.fn(),
}))

const server = vi.hoisted(() => ({
	search: vi.fn(),
	popular: vi.fn(),
	recipe: vi.fn(),
	save: vi.fn(),
}))

vi.mock('@/lib/home/server', () => ({
	homeNow: home.now,
}))

// Nothing in progress unless a test says so.
vi.mock('@/lib/cooking/server', () => ({
	listInProgress: () => home.inProgress(),
	getPlan: async () => null,
	planCook: vi.fn(),
	dropPlan: vi.fn(),
	finishCook: vi.fn(),
	unfinishCook: vi.fn(),
}))

vi.mock('@/lib/groceries/server', () => ({
	setGroceryBrand: vi.fn(),
	recipeLinesGoing: async () => 0,
	listGroceries: async () => [],
	countWaitingGroceries: async () => 0,
	addGroceries: vi.fn(),
	setGroceryChecked: vi.fn(),
	renameGrocery: vi.fn(),
	deleteGrocery: vi.fn(),
	clearCheckedGroceries: vi.fn(),
	restoreCart: vi.fn(),
	leaveGrocery: vi.fn(),
}))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: server.search,
	popularRecipes: server.popular,
}))

vi.mock('@/lib/import/server', () => ({
	importRecipe: vi.fn(),
	peekRecipes: async () => [],
}))

vi.mock('@/lib/recipes/server', async (importOriginal) => ({
	...(await importOriginal<object>()),
	listShelf: () => Promise.resolve({ recipes: [], signedIn: true }),
	getRecipe: server.recipe,
	saveRecipe: server.save,
}))

const session = {
	user: { id: 'user-1', name: 'Cook', email: 'cook@example.com' },
	session: { id: 'session-1', token: 'token' },
}

const idle: Now = {
	signedIn: true,
	cooking: null,
	shopping: null,
	waiting: 0,
	inProgress: 0,
	loose: 0,
}

describe('home', () => {
	beforeEach(() => {
		// The cat names the day, so the captures need a fixed one: a Thursday
		// morning. Only the date is held; timers still run.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(2026, 10, 12, 9))
		home.now.mockReset().mockResolvedValue(idle)
		home.inProgress.mockReset().mockResolvedValue([])
		server.search.mockReset().mockResolvedValue({ results: [] })
		server.popular.mockReset().mockResolvedValue({ results: [] })
		server.recipe.mockReset().mockResolvedValue(null)
		server.save.mockReset().mockResolvedValue(null)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test('leads with the recipe being cooked', async () => {
		home.now.mockResolvedValue({
			...idle,
			waiting: 6,
			cooking: {
				recipeId: 'pasta',
				title: 'miso butter pasta',
				minutesIn: 12,
				steps: 6,
				on: 3,
				step: 'toss the pasta with the miso butter',
				next: 'grate in the parmesan',
			},
		})

		const { screen } = await renderRoute({ path: '/', session })

		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'still cooking' }))
			.toBeVisible()
		await expect
			.element(screen.getByText('step 3 of 6', { exact: false }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'back to it' }))
			.toHaveAttribute('href', '/recipes/pasta')
		await expectPageScreenshot(screen.container, 'home-cooking')
	})

	test('fills the progress bar once every step is done', async () => {
		home.now.mockResolvedValue({
			...idle,
			cooking: {
				recipeId: 'pasta',
				title: 'miso butter pasta',
				minutesIn: 30,
				steps: 6,
				on: 6,
				step: null,
				next: null,
			},
		})

		const { screen } = await renderRoute({ path: '/', session })

		await expect
			.element(screen.getByRole('progressbar'))
			.toHaveAttribute('value', '6')
	})

	test('leads with the shop under way', async () => {
		home.now.mockResolvedValue({
			...idle,
			waiting: 5,
			shopping: {
				inCart: 4,
				total: 9,
				left: ['1 onion', '2 limes', 'butter', 'eggs', 'salmon'],
				recipes: ['salmon with greens'],
			},
		})

		const { screen } = await renderRoute({ path: '/', session })

		// The cat only says to finish, and the card is one line to the list.
		await expect
			.element(
				screen.getByRole('heading', { level: 1, name: 'finish shopping' }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('4 of 9 in the cart')).toBeVisible()
		await expect
			.element(
				screen.getByRole('link', { name: 'groceries: 4 of 9 in the cart' }),
			)
			.toHaveAttribute('href', '/groceries')
		await expectPageScreenshot(screen.container, 'home-shopping')
	})

	test('says to finish shopping as soon as the list has anything on it', async () => {
		home.now.mockResolvedValue({
			...idle,
			waiting: 2,
			shopping: { inCart: 0, total: 2, left: ['milk', 'eggs'], recipes: [] },
		})

		const { screen } = await renderRoute({ path: '/', session })

		await expect
			.element(
				screen.getByRole('heading', { level: 1, name: 'finish shopping' }),
			)
			.toBeVisible()
		await expect.element(screen.getByText('0 of 2 in the cart')).toBeVisible()
	})

	test('leaves the list to the recipes in progress until the shop starts', async () => {
		const chili = {
			recipeId: 'chili',
			skipped: [],
			plannedAt: new Date(),
			title: 'green chili',
			imageUrl: null,
			ingredients: ['1 onion'],
		}

		home.inProgress.mockResolvedValue([chili])
		home.now.mockResolvedValue({
			...idle,
			waiting: 2,
			inProgress: 1,
			loose: 0,
			shopping: { inCart: 0, total: 2 },
		})

		const before = await renderRoute({ path: '/', session })

		await expect
			.element(before.screen.getByRole('heading', { name: /^in progress/ }))
			.toBeVisible()
		await expect
			.element(before.screen.getByText('0 of 2 in the cart'))
			.not.toBeInTheDocument()
		// Nor does the cat say to finish a shop that hasn't started.
		await expect
			.element(
				before.screen.getByRole('heading', {
					level: 1,
					name: 'what are you making?',
				}),
			)
			.toBeVisible()

		// Once something is in the cart, the list's bar is back.
		home.now.mockResolvedValue({
			...idle,
			waiting: 1,
			inProgress: 1,
			loose: 0,
			shopping: { inCart: 1, total: 2 },
		})

		const shopping = await renderRoute({ path: '/', session })

		await expect
			.element(shopping.screen.getByText('1 of 2 in the cart'))
			.toBeVisible()
	})

	test('opens on the search when nothing is under way', async () => {
		const { screen } = await renderRoute({ path: '/', session })

		await expect
			.element(
				screen.getByRole('heading', {
					level: 1,
					name: 'what are you making?',
				}),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('combobox', { name: 'find a recipe' }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'home')
	})

	test('starts reading a recipe at the touch, before the tap lands', async () => {
		server.popular.mockResolvedValue({
			results: [
				{
					recipeId: 'dal',
					title: 'red lentil dal',
					siteName: 'Example',
					saved: false,
					draft: false,
					ingredientMatches: [],
				},
			],
		})

		const { screen } = await renderRoute({ path: '/', session })

		const row = screen.getByRole('option', { name: /red lentil dal/ })

		await expect.element(row).toBeVisible()
		row
			.element()
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		await expect
			.poll(() => server.recipe.mock.calls[0]?.[0])
			.toEqual({ data: { id: 'dal' } })
	})

	test('does not start reading a recipe while its save is on its way', async () => {
		server.popular.mockResolvedValue({
			warming: false,
			results: [
				{
					recipeId: 'dal',
					title: 'red lentil dal',
					siteName: 'Example',
					saved: false,
					draft: false,
					ingredientMatches: [],
				},
			],
		})
		server.save.mockImplementation(() => new Promise(() => {}))

		const { screen } = await renderRoute({ path: '/', session })

		await screen.getByRole('button', { name: 'save red lentil dal' }).click()
		await expect.poll(() => server.save.mock.calls.length).toBe(1)

		screen
			.getByRole('option', { name: /red lentil dal/ })
			.element()
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(server.recipe).not.toHaveBeenCalled()
	})

	test('does not start reading a recipe when its save button is pressed', async () => {
		server.popular.mockResolvedValue({
			results: [
				{
					recipeId: 'dal',
					title: 'red lentil dal',
					siteName: 'Example',
					saved: false,
					draft: false,
					ingredientMatches: [],
				},
			],
		})

		const { screen } = await renderRoute({ path: '/', session })

		const save = screen.getByRole('button', { name: 'save red lentil dal' })

		await expect.element(save).toBeVisible()
		save
			.element()
			.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(server.recipe).not.toHaveBeenCalled()
	})

	test('goes on as the list is scrolled, with no button to press', async () => {
		server.popular.mockResolvedValue({
			results: Array.from({ length: 30 }, (_, index) => ({
				recipeId: `popular-${index}`,
				title: `popular recipe ${index}`,
				siteName: 'Example',
				saved: false,
				draft: false,
				ingredientMatches: [],
			})),
		})

		const { screen } = await renderRoute({ path: '/', session })

		const rows = () =>
			screen.getByRole('option', { name: /popular recipe/ }).all().length

		await expect.poll(rows).toBeGreaterThan(0)
		const first = rows()

		await expect
			.element(screen.getByRole('button', { name: 'show more recipes' }))
			.not.toBeInTheDocument()
		screen.getByText('more recipes…').element().scrollIntoView()
		await expect.poll(rows).toBeGreaterThan(first)
	})

	test('stops going on by itself after a while, and asks', async () => {
		server.popular.mockResolvedValue({
			results: Array.from({ length: 100 }, (_, index) => ({
				recipeId: `popular-${index}`,
				title: `popular recipe ${index}`,
				siteName: 'Example',
				saved: false,
				draft: false,
				ingredientMatches: [],
			})),
		})

		const { screen } = await renderRoute({ path: '/', session })

		const rows = () =>
			screen.getByRole('option', { name: /popular recipe/ }).all().length

		await expect.poll(rows).toBeGreaterThan(0)

		// Scrolled to the end again and again, it stops at sixty and asks.
		for (let batch = 0; batch < 6; batch++) {
			if (!screen.getByText('more recipes…').query()) break

			// Scrolled again on each look, since a slow machine can miss one.
			await expect
				.poll(
					() => {
						screen.getByText('more recipes…').query()?.scrollIntoView()

						return rows()
					},
					{ timeout: 15_000 },
				)
				.toBeGreaterThan(12 * (batch + 1) - 1)
		}

		await expect.poll(rows).toBe(60)
		await screen.getByRole('button', { name: 'show more recipes' }).click()
		await expect.poll(rows).toBe(72)
	})
})
