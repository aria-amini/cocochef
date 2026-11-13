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
}

const shelfState = vi.hoisted<ShelfState>(() => ({
	recipes: [],
}))

const discovery = vi.hoisted(() => ({
	import: vi.fn(),
}))

const saves = vi.hoisted(() => ({
	remove: vi.fn(),
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
	removeSavedRecipe: saves.remove,
	saveRecipe: saves.save,
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
		saves.remove.mockReset().mockResolvedValue(null)
		saves.save.mockReset().mockResolvedValue(null)
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

	test('keeps the add button on an empty shelf and a full one', async () => {
		const { screen, router, queryClient } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('button', { name: /save your first recipe/ }))
			.toBeVisible()
		// Adding stays where it always is.
		await expect
			.element(screen.getByRole('button', { name: 'add recipe' }))
			.toBeVisible()

		shelfState.recipes = [dal]
		await queryClient.invalidateQueries()
		await router.invalidate()

		await expect
			.element(screen.getByRole('link', { name: 'dal' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'add recipe' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: /save your first recipe/ }))
			.not.toBeInTheDocument()
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

	test('shows the ways to add a recipe', async () => {
		shelfState.recipes = [misoButterPasta, dal]

		const { screen } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await expect.element(screen.getByText('miso butter pasta')).toBeVisible()
		await expect.element(screen.getByText('dal')).toBeVisible()

		// Every way to add a recipe sits behind one button, desktop and phone.
		await expect
			.element(screen.getByRole('button', { name: 'add recipe' }))
			.toBeVisible()
	})

	test('imports a link from the add menu', async () => {
		discovery.import.mockResolvedValue({ id: dal.id, title: 'dal' })
		shelfState.recipes = [dal]

		const { screen, router } = await renderRoute({
			path: '/recipes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'add recipe' }).click()
		await screen.getByRole('menuitem', { name: 'import url' }).click()
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
			.element(screen.getByRole('button', { name: /save your first recipe/ }))
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
