import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
	expectPendingScreenshot,
} from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

type ShelfState = {
	recipes: Recipe[]
	signedIn: boolean
	// Who the shelf says is asking; null leaves it to the browser's session.
	viewerId: string | null
	// The shelf never arrives, so the page stays on its skeleton.
	hang: boolean
	// The next read of the shelf waits for this.
	read?: Promise<void> | undefined
}

const shelfState = vi.hoisted<ShelfState>(() => ({
	recipes: [],
	signedIn: true,
	viewerId: null,
	hang: false,
}))

const discovery = vi.hoisted(() => ({
	import: vi.fn(),
}))

const saves = vi.hoisted(() => ({
	remove: vi.fn(),
	removeMany: vi.fn(),
	save: vi.fn(),
}))

vi.mock('@/lib/home/server', () => ({
	homeNow: async () => ({
		signedIn: true,
		cooking: null,
		shopping: null,
		waiting: 0,
	}),
}))

vi.mock('@/lib/import/server', () => ({
	importRecipe: discovery.import,
	peekRecipes: () => Promise.resolve([]),
}))

vi.mock('@/lib/recipes/server', () => ({
	deleteRecipes: saves.removeMany,
	removeSavedRecipe: saves.remove,
	saveRecipe: saves.save,
	listShelf: async () => {
		if (shelfState.hang) return new Promise(() => {})

		// As the server has it when the read starts, however long it takes.
		const recipes = shelfState.recipes

		await shelfState.read

		return {
			recipes,
			signedIn: shelfState.signedIn,
			viewerId: shelfState.viewerId,
		}
	},
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
}

const dal: Recipe = {
	id: 'recipe-2',
	userId: 'user-1',
	visibility: null,
	title: 'dal',
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
}

describe('recipes shelf', () => {
	beforeEach(() => {
		shelfState.recipes = []
		shelfState.signedIn = true
		shelfState.viewerId = null
		shelfState.hang = false
		shelfState.read = undefined
		saves.remove.mockReset().mockResolvedValue(null)
		saves.save.mockReset().mockResolvedValue(null)
		saves.removeMany.mockReset().mockResolvedValue({ removed: 0 })
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

	test('files your own recipes as yours before the browser reads the session', async () => {
		shelfState.viewerId = 'user-1'
		shelfState.recipes = [
			misoButterPasta,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		// The browser has no session yet; the shelf already says who asked.
		const { screen } = await renderRoute({ path: '/recipes' })

		const yours = screen.getByRole('region', { name: 'your recipes' })
		const saved = screen.getByRole('region', { name: 'saved recipes' })
		await expect.element(yours.getByText('miso butter pasta')).toBeVisible()
		await expect
			.element(saved.getByText('miso butter pasta'))
			.not.toBeInTheDocument()
	})

	test('opens a blank recipe from the add tile on an empty shelf', async () => {
		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const yours = screen.getByRole('region', { name: 'your recipes' })
		await yours.getByRole('link', { name: 'add a recipe' }).click()
		await expect.poll(() => router.state.location.pathname).toBe('/recipes/new')
	})

	test('asks a visitor to sign up instead of showing a shelf', async () => {
		shelfState.signedIn = false

		const { screen } = await renderRoute({ path: '/recipes' })

		await expect
			.element(
				screen.getByRole('heading', { name: 'keep your recipes in one place' }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('link', { name: 'add a recipe' }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'create an account' }).click()
		await expect.element(screen.getByRole('dialog')).toBeVisible()
	})

	test('marks the saved section with the eggplant bookmark, apart from your own', async () => {
		shelfState.recipes = [
			misoButterPasta,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const heading = (name: string) =>
			screen.getByRole('heading', { name, level: 2 }).element()

		const eggplant = 'rgb(91, 61, 245)'

		await expect.element(screen.getByText('shared soup')).toBeVisible()
		const bookmark = heading('saved recipes').querySelector('svg')

		if (!bookmark) throw new Error('saved heading is missing its bookmark')
		expect(getComputedStyle(bookmark).color).toBe(eggplant)
		// Your own section keeps a plain icon.
		const person = heading('your recipes').querySelector('svg')

		if (!person) throw new Error('your heading is missing its icon')
		expect(getComputedStyle(person).color).not.toBe(eggplant)
	})

	test('takes a saved recipe off its tile, with undo', async () => {
		shelfState.recipes = [
			misoButterPasta,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		// Your own recipes carry no chip; only saved ones do.
		await expect
			.element(screen.getByRole('button', { name: 'unsave shared soup' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'unsave miso butter pasta' }))
			.not.toBeInTheDocument()

		// The server is slow to answer, and the tile doesn't wait for it.
		let answer = () => {}

		saves.remove.mockImplementation(
			() =>
				new Promise((resolve) => {
					answer = () => resolve(null)
				}),
		)
		await screen.getByRole('button', { name: 'unsave shared soup' }).click()
		await expect
			.poll(() => saves.remove)
			.toHaveBeenCalledWith({ data: { id: 'shared' } })
		await expect
			.element(screen.getByText('shared soup'))
			.not.toBeInTheDocument()

		shelfState.recipes = [misoButterPasta]
		answer()
		await expect
			.element(screen.getByText('taken off your recipes'))
			.toBeVisible()

		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.poll(() => saves.save)
			.toHaveBeenCalledWith({ data: { id: 'shared' } })
	})

	test('imports a link from a blank recipe, leaving no blank page behind', async () => {
		discovery.import.mockResolvedValue({ id: dal.id, title: 'dal' })
		shelfState.recipes = [dal]

		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('link', { name: 'add a recipe' }).click()
		await screen.getByRole('button', { name: 'import from a link' }).click()
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

		// The import took the blank recipe's place, so back is the shelf.
		router.history.back()
		await expect.poll(() => router.state.location.pathname).toBe('/recipes')
	})

	test('offers no choosing until it knows whose recipes are whose', async () => {
		shelfState.recipes = [misoButterPasta]

		// The shelf loaded, but the account in the browser hasn't.
		const { screen } = await renderRoute({ path: '/recipes' })

		await expect
			.element(screen.getByRole('link', { name: 'miso butter pasta' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'select', exact: true }))
			.not.toBeInTheDocument()
	})

	test('selects recipes and clears them off the shelf together', async () => {
		saves.removeMany.mockResolvedValue({ removed: 2 })
		shelfState.recipes = [
			misoButterPasta,
			dal,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'select', exact: true }).click()
		// While picking, a tile toggles rather than opens.
		await screen.getByRole('button', { name: 'dal' }).click()
		await screen.getByRole('button', { name: 'shared soup' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'dal' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect.element(screen.getByText('2 selected')).toBeVisible()
		// The tile to add a recipe steps aside.
		await expect
			.element(screen.getByRole('link', { name: 'add a recipe' }))
			.not.toBeInTheDocument()

		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		const dialog = screen.getByRole('dialog', { name: 'delete 2 recipes?' })

		// Says what happens to each kind before anything is lost.
		await expect
			.element(
				dialog.getByText(
					'the 1 recipe you wrote is deleted for good, with your notes. the 1 you saved just comes off your shelf.',
					{ exact: false },
				),
			)
			.toBeVisible()
		// The server is slow to answer, and the shelf doesn't wait for it.
		let answer = () => {}

		saves.removeMany.mockImplementation(
			() =>
				new Promise((resolve) => {
					answer = () => resolve({ removed: 2 })
				}),
		)
		await dialog.getByRole('button', { name: 'delete', exact: true }).click()
		await expect
			.poll(() => saves.removeMany.mock.calls[0]?.[0])
			.toEqual({ data: { ids: ['recipe-2', 'shared'] } })
		await expect.element(screen.getByText('2 selected')).not.toBeInTheDocument()
		await expect.element(screen.getByText('dal')).not.toBeInTheDocument()
		await expect
			.element(screen.getByText('shared soup'))
			.not.toBeInTheDocument()
		await expect.element(screen.getByText('miso butter pasta')).toBeVisible()

		// The shelf is slow to read again too, and the cleared ones stay gone
		// until it arrives, rather than coming back in the meantime.
		let arrive = () => {}

		shelfState.read = new Promise((resolve) => {
			arrive = resolve
		})
		shelfState.recipes = [misoButterPasta]
		answer()
		await expect
			.element(screen.getByText('2 recipes off your shelf'))
			.toBeVisible()
		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(screen.getByText('dal').query()).toBeNull()

		arrive()
		await expect.element(screen.getByText('dal')).not.toBeInTheDocument()
		expect(screen.getByText('miso butter pasta').query()).not.toBeNull()
	})

	test('keeps a second clear off the shelf while the first is still being read', async () => {
		const soup = { ...dal, id: 'recipe-3', title: 'lentil soup' }

		shelfState.recipes = [misoButterPasta, dal, soup]
		saves.removeMany.mockImplementation(
			async ({ data }: { data: { ids: string[] } }) => {
				shelfState.recipes = shelfState.recipes.filter(
					(recipe) => !data.ids.includes(recipe.id),
				)

				return { removed: data.ids.length }
			},
		)

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const clear = async (title: string) => {
			await screen.getByRole('button', { name: 'select', exact: true }).click()
			await screen.getByRole('button', { name: title }).click()
			await screen.getByRole('button', { name: 'delete', exact: true }).click()
			await screen
				.getByRole('dialog')
				.getByRole('button', { name: 'delete', exact: true })
				.click()
		}

		// The first clear's read of the shelf is slow, on a slow connection,
		// and the cook clears another meanwhile.
		let arrive = () => {}

		shelfState.read = new Promise((resolve) => {
			arrive = resolve
		})
		await clear('dal')
		await expect.poll(() => saves.removeMany.mock.calls.length).toBe(1)
		await clear('lentil soup')
		await expect.poll(() => saves.removeMany.mock.calls.length).toBe(2)

		arrive()
		await new Promise((resolve) => setTimeout(resolve, 500))
		expect(screen.getByText('lentil soup').query()).toBeNull()
		expect(screen.getByText('dal', { exact: true }).query()).toBeNull()
		expect(screen.getByText('miso butter pasta').query()).not.toBeNull()
	})

	test('keeps a newer selection when an earlier clear fails', async () => {
		const soup = { ...dal, id: 'recipe-3', title: 'lentil soup' }

		shelfState.recipes = [misoButterPasta, dal, soup]

		let fail = () => {}

		saves.removeMany.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					fail = () => reject(new Error('offline'))
				}),
		)

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		// Clearing dal is still on its way when the cook starts choosing again.
		await screen.getByRole('button', { name: 'select', exact: true }).click()
		await screen.getByRole('button', { name: 'dal' }).click()
		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		await screen
			.getByRole('dialog')
			.getByRole('button', { name: 'delete', exact: true })
			.click()
		await screen.getByRole('button', { name: 'select', exact: true }).click()
		await screen.getByRole('button', { name: 'lentil soup' }).click()

		fail()
		await expect
			.element(screen.getByText("couldn't delete those — try again"))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'lentil soup' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect
			.element(screen.getByRole('button', { name: 'dal' }))
			.toHaveAttribute('aria-pressed', 'false')
		await expect.element(screen.getByText('1 selected')).toBeVisible()
	})

	test('restores the later clear, not the earlier, when both fail', async () => {
		const soup = { ...dal, id: 'recipe-3', title: 'lentil soup' }

		shelfState.recipes = [misoButterPasta, dal, soup]

		const failures: (() => void)[] = []

		const failLater = () =>
			new Promise((_resolve, reject) => {
				failures.push(() => reject(new Error('offline')))
			})

		saves.removeMany
			.mockImplementationOnce(failLater)
			.mockImplementationOnce(failLater)

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const clear = async (title: string) => {
			await screen.getByRole('button', { name: 'select', exact: true }).click()
			await screen.getByRole('button', { name: title }).click()
			await screen.getByRole('button', { name: 'delete', exact: true }).click()
			await screen
				.getByRole('dialog')
				.getByRole('button', { name: 'delete', exact: true })
				.click()
		}

		// Both clears are on their way; the earlier one fails first.
		await clear('dal')
		await clear('lentil soup')
		await expect.poll(() => failures.length).toBe(2)

		failures[0]?.()
		await expect
			.element(screen.getByText("couldn't delete those — try again"))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'select', exact: true }))
			.toBeVisible()

		// The later one fails too: its recipe is the one picked again.
		failures[1]?.()
		await expect
			.element(screen.getByRole('button', { name: 'lentil soup' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect
			.element(screen.getByRole('button', { name: 'dal' }))
			.toHaveAttribute('aria-pressed', 'false')
		await expect.element(screen.getByText('1 selected')).toBeVisible()
	})

	test('puts recipes back when clearing them fails', async () => {
		saves.removeMany.mockRejectedValue(new Error('offline'))
		shelfState.recipes = [misoButterPasta, dal]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'select', exact: true }).click()
		await screen.getByRole('button', { name: 'dal' }).click()
		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		await screen
			.getByRole('dialog')
			.getByRole('button', { name: 'delete', exact: true })
			.click()

		await expect
			.element(screen.getByText("couldn't delete those — try again"))
			.toBeVisible()
		// Back on the shelf, and still picked, so trying again is one tap.
		await expect
			.element(screen.getByRole('button', { name: 'dal' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect.element(screen.getByText('1 selected')).toBeVisible()
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

	test('keeps drafts apart, saying how far each has got', async () => {
		shelfState.recipes = [
			{ ...dal, finalizedAt: null, written: { ingredients: 3, steps: 0 } },
			misoButterPasta,
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		const drafts = screen.getByRole('region', { name: 'drafts' })

		await expect
			.element(drafts.getByRole('link', { name: /dal/ }))
			.toHaveTextContent('dal3 ingredients · no steps yetkeep writing')
		await expect
			.element(
				screen
					.getByRole('region', { name: 'your recipes' })
					.getByRole('link', { name: /dal/ }),
			)
			.not.toBeInTheDocument()
		await expectIsolatedScreenshot(drafts, 'shelf-drafts')
	})

	// Full-height captures of the shelf page alone. The app shell around it has
	// its own baselines.
	test('captures the empty shelf', async () => {
		// The command glyph comes from whichever system font has it, so only the
		// ctrl hint can be compared across machines. The hint test asserts the Mac
		// text instead.
		vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('link', { name: 'add a recipe' }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'shelf-empty', {
			fullHeight: true,
		})
	})

	test('captures the shelf with a draft and a saved recipe', async () => {
		// The command glyph comes from whichever system font has it, so only the
		// ctrl hint can be compared across machines. The hint test asserts the Mac
		// text instead.
		vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')
		shelfState.recipes = [
			{ ...dal, finalizedAt: null },
			misoButterPasta,
			{ ...dal, id: 'shared', title: 'shared soup', userId: null },
		]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('link', { name: /dal/ }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'shelf', { fullHeight: true })
	})

	test('draws a slow shelf as its grid of tiles', async () => {
		const { screen, router } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		shelfState.hang = true
		void router.navigate({ to: '/recipes' })

		await expectPendingScreenshot(screen, 'shelf-pending')
	})
})
