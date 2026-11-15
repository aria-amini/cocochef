import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
} from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { listShelf } from '@/lib/recipes/server'

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

type ShelfState = {
	recipes: Recipe[]
	signedIn: boolean
}

const shelfState = vi.hoisted<ShelfState>(() => ({
	recipes: [],
	signedIn: true,
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
	listShelf: () =>
		Promise.resolve({
			recipes: shelfState.recipes,
			signedIn: shelfState.signedIn,
		}),
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

		await screen.getByRole('button', { name: 'unsave shared soup' }).click()
		await expect
			.poll(() => saves.remove)
			.toHaveBeenCalledWith({ data: { id: 'shared' } })
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
		await dialog.getByRole('button', { name: 'delete', exact: true }).click()
		await expect
			.poll(() => saves.removeMany.mock.calls[0]?.[0])
			.toEqual({ data: { ids: ['recipe-2', 'shared'] } })
		await expect.element(screen.getByText('2 selected')).not.toBeInTheDocument()
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
})
