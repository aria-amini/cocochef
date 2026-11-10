import { getAuthMocks, setMockSession } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { expectIsolatedScreenshot } from '@tests/support/screenshot'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

type Saved = {
	id?: string
	title: string
	imageUrl?: string | null
	notes?: string | null
	ingredients?: string[]
	steps?: string[]
	finalized?: boolean
	finalize?: boolean
}

type State = {
	created: Saved[]
	updated: Saved[]
	deleted: string[]
}

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))

vi.mock('@sentry/tanstackstart-react', async (importOriginal) => ({
	...(await importOriginal<typeof import('@sentry/tanstackstart-react')>()),
	captureException: sentry.captureException,
}))

const state = vi.hoisted<State>(() => ({
	created: [],
	updated: [],
	deleted: [],
}))

// The latest content saved for the new recipe, created or updated.
const latest = () => state.updated.at(-1) ?? state.created.at(-1)

// Recipes online for the name being written, and their content when opened.
type Online = {
	results: { recipeId: string; title: string; siteName: string }[]
	recipe: {
		id: string
		title: string
		sourceUrl: string
		ingredients: string[]
		steps: string[]
	} | null
}

const online = vi.hoisted<Online>(() => ({ results: [], recipe: null }))

vi.mock('@/lib/discover/server', () => ({
	searchRecipes: () =>
		Promise.resolve({
			warming: false,
			results: online.results.map((recipe) => ({
				...recipe,
				saved: false,
				draft: false,
				ingredientMatches: [],
			})),
		}),
	popularRecipes: () => Promise.resolve({ warming: false, results: [] }),
}))

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [] }),
	getRecipe: () => Promise.resolve(online.recipe),
	createRecipe: async ({ data }: { data: Saved }) => {
		state.created.push(data)

		return { id: 'recipe-new' }
	},
	updateRecipe: async ({ data }: { data: Saved }) => {
		state.updated.push(data)

		return { id: 'recipe-new' }
	},
	deleteRecipe: async ({ data }: { data: { id: string } }) => {
		state.deleted.push(data.id)

		return true
	},
}))

vi.mock('@/lib/s3', () => ({
	getRecipePhotoUploadUrl: () =>
		Promise.resolve({
			key: 'recipes/user-1-photo',
			url: 'https://storage.test/upload',
		}),
}))

const testSession = {
	user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
	session: { id: 'session-1', token: 'token' },
}

// Pastes text into a field the way the clipboard does.
function pasteInto(field: { element: () => Element }, text: string) {
	const data = new DataTransfer()
	data.setData('text', text)
	field.element().dispatchEvent(
		new ClipboardEvent('paste', {
			clipboardData: data,
			bubbles: true,
			cancelable: true,
		}),
	)
}

describe('write a recipe', () => {
	beforeEach(() => {
		sessionStorage.removeItem('recipe-paste')
		state.created = []
		state.updated = []
		state.deleted = []
		sentry.captureException.mockClear()
	})

	test('keeps a pasted recipe through account creation', async () => {
		const { screen, router } = await renderRoute({ path: '/recipes' })
		const pasted = 'Soup\ningredients\n1 onion\nmethod\n1. simmer'
		await router.navigate({ to: '/recipes/new', state: { pasted } })
		await expect
			.element(screen.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
		expect(router.state.location.state.pasted).toBe(pasted)
		getAuthMocks().signUpEmail.mockImplementationOnce(async () => {
			setMockSession(testSession)

			return { error: null }
		})
		const signup = screen.getByRole('dialog', { name: 'create an account' })
		await signup.getByLabelText('name').fill('Test User')
		await signup.getByLabelText('email').fill('test@example.com')
		await signup.getByLabelText('password').fill('password123')
		await signup
			.getByRole('button', { name: 'create account', exact: true })
			.click()
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('Soup')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 1' }))
			.toHaveValue('simmer')
	})

	test('restores a pasted recipe after an external sign-in navigation', async () => {
		const first = await renderRoute({ path: '/recipes' })
		const pasted = 'Soup\ningredients\n1 onion\nmethod\n1. simmer'
		await first.router.navigate({ to: '/recipes/new', state: { pasted } })
		await expect.poll(() => sessionStorage.getItem('recipe-paste')).toBe(pasted)

		await first.screen.unmount()

		const next = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await expect
			.element(next.screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('Soup')
		await expect
			.element(next.screen.getByRole('textbox', { name: 'Step 1' }))
			.toHaveValue('simmer')
		await expect.poll(() => sessionStorage.getItem('recipe-paste')).toBeNull()
	})

	test('starts on a blank recipe with the name focused', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveFocus()
		await expect
			.element(screen.getByRole('button', { name: 'save' }))
			.toBeVisible()
	})

	test('keeps save disabled until a new recipe has content', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const save = screen.getByRole('button', { name: 'save', exact: true })
		await expect.element(save).toBeDisabled()
		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await expect.element(save).toBeEnabled()
		await expect.element(screen.getByText('not saved yet: name')).toBeVisible()
	})

	test('accepts notes with 1,001 emoji without treating them as too long', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('toast')
		const notes = '😀'.repeat(1001)
		await screen.getByRole('textbox', { name: 'notes' }).fill(notes)
		await expect
			.element(
				screen.getByText(
					'notes are too long to save — shorten them to 2,000 characters',
				),
			)
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(latest).toEqual(expect.objectContaining({ notes }))
	})

	test('keeps long pasted notes visible and explains why they cannot yet be saved', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const longNotes = 'a'.repeat(2001)
		pasteInto(
			screen.getByRole('textbox', { name: 'name' }),
			`Toast\nIngredients\n2 slices bread\nSteps\nToast.\nNotes\n${longNotes}`,
		)
		const notes = screen.getByRole('textbox', { name: 'notes' })
		await expect.element(notes).toHaveValue(longNotes)
		await expect
			.element(
				screen.getByText(
					'notes are too long to save — shorten them to 2,000 characters',
				),
			)
			.toBeVisible()
		await notes.fill('short note')
		await expect
			.element(
				screen.getByText(
					'notes are too long to save — shorten them to 2,000 characters',
				),
			)
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(latest)
			.toEqual(expect.objectContaining({ notes: 'short note' }))
	})

	test('lines the photo up with the name and its links', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const intro = screen.getByRole('group', { name: 'about the recipe' })
		await expect.element(intro).toBeVisible()
		await expectIsolatedScreenshot(intro, 'new-recipe-intro')
	})

	test('sorts a whole recipe pasted into the name, with undo', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await expect
			.element(
				screen.getByText('or paste a link or a whole recipe into the name'),
			)
			.toBeVisible()
		pasteInto(
			screen.getByRole('textbox', { name: 'name' }),
			'Toast\nIngredients\n2 slices bread\nSteps\nToast the bread.\nNotes\nUse fresh bread.',
		)
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('Toast')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 1' }))
			.toHaveValue('Toast the bread.')
		await expect
			.element(screen.getByRole('textbox', { name: 'notes' }))
			.toHaveValue('Use fresh bread.')
		expect(state.created).toEqual([])
		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'notes' }))
			.toHaveValue('')
	})

	test('imports a link pasted into the empty name, and keeps the editor when cancelled', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		pasteInto(
			screen.getByRole('textbox', { name: 'name' }),
			'https://example.com/dal',
		)
		const dialog = screen.getByRole('dialog', { name: 'import a recipe' })
		await expect.element(dialog).toBeVisible()
		await expect
			.element(dialog.getByRole('textbox'))
			.toHaveValue('https://example.com/dal')
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('')
	})

	test('creates a finished recipe only when save is pressed', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen
			.getByRole('textbox', { name: 'Step 1' })
			.fill('slice the bread')
		expect(state.created).toEqual([])
		await screen.getByRole('button', { name: 'save' }).click()
		await expect
			.poll(() => state.created.at(-1))
			.toEqual(
				expect.objectContaining({
					title: 'Toast',
					steps: ['slice the bread'],
					finalized: true,
				}),
			)
	})

	test('leaving without saving does not create a recipe', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await router.navigate({ to: '/recipes' })
		expect(state.created).toEqual([])
	})

	test('finishes the draft with save and opens it', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-new')
		expect(state.created.at(-1)).toEqual(
			expect.objectContaining({ title: 'Toast', finalized: true }),
		)
		await expect
			.element(screen.getByText('Toast is on your shelf'))
			.toBeVisible()
	})

	test('saves a name carried over from the search when save is pressed untouched', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes/new?title=Pancakes',
			session: testSession,
		})

		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-new')
		expect(state.created.at(-1)).toEqual(
			expect.objectContaining({ title: 'Pancakes' }),
		)
	})

	test('asks for a name before saving', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'notes' }).fill('some notes')
		await screen.getByRole('button', { name: 'save' }).click()

		const name = screen.getByRole('textbox', { name: 'name' })
		await expect
			.element(screen.getByRole('alert'))
			.toHaveTextContent('give the recipe a name to finish it')
		// Said at the name, not down by save.
		await expect.element(name).toHaveFocus()
		await expect.element(name).toHaveAttribute('aria-invalid', 'true')
		await expect
			.element(name)
			.toHaveAccessibleDescription('give the recipe a name to finish it')
		expect(state.created).toEqual([])
	})

	test('carries a name over from the shelf search', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new?title=ramen',
			session: testSession,
		})

		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('ramen')
	})

	test('sorts a whole recipe pasted into the name', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const name = screen.getByRole('textbox', { name: 'name' })
		const data = new DataTransfer()
		data.setData(
			'text',
			'weeknight dal\ningredients\n1 cup red lentils\n1 tbsp ghee\nmethod\n1. rinse the lentils\n2. simmer',
		)
		name.element().dispatchEvent(
			new ClipboardEvent('paste', {
				clipboardData: data,
				bubbles: true,
				cancelable: true,
			}),
		)

		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('weeknight dal')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 2' }))
			.toHaveValue('simmer')
		await expect
			.element(screen.getByText('sorted into 2 ingredients and 2 steps'))
			.toBeVisible()
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(latest).toEqual(
			expect.objectContaining({
				title: 'weeknight dal',
				ingredients: ['1 cup red lentils', '1 tbsp ghee'],
				steps: ['rinse the lentils', 'simmer'],
			}),
		)
	})

	test('undoes a sorted paste before saving', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const data = new DataTransfer()
		data.setData('text', 'weeknight dal\n1 cup red lentils\n1. simmer')
		screen
			.getByRole('textbox', { name: 'name' })
			.element()
			.dispatchEvent(
				new ClipboardEvent('paste', {
					clipboardData: data,
					bubbles: true,
					cancelable: true,
				}),
			)
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('weeknight dal')
		expect(state.created).toEqual([])
		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('')
		expect(state.deleted).toEqual([])
	})

	test('takes the paste undo away once the recipe is finished', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const data = new DataTransfer()
		data.setData('text', 'weeknight dal\n1 cup red lentils\n1. simmer')
		screen
			.getByRole('textbox', { name: 'name' })
			.element()
			.dispatchEvent(
				new ClipboardEvent('paste', {
					clipboardData: data,
					bubbles: true,
					cancelable: true,
				}),
			)
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('weeknight dal')
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeEnabled()
		// The "sorted into" toast can sit over the button on a short screen.
		screen
			.getByRole('button', { name: 'save' })
			.element()
			.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			)
		await expect
			.poll(() => state.created.some((saved) => saved.finalized))
			.toBe(true)

		await expect
			.element(screen.getByRole('button', { name: 'undo' }))
			.not.toBeInTheDocument()
		expect(state.deleted).toEqual([])
	})

	test('keeps rows already typed when a recipe is pasted into the empty name', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen
			.getByRole('combobox', { name: 'Ingredient 1' })
			.fill('my own onion')
		await userEvent.keyboard('{Escape}')

		const data = new DataTransfer()
		data.setData('text', 'dal\ningredients\n1 cup lentils\nmethod\n1. simmer')
		screen
			.getByRole('textbox', { name: 'name' })
			.element()
			.dispatchEvent(
				new ClipboardEvent('paste', {
					clipboardData: data,
					bubbles: true,
					cancelable: true,
				}),
			)

		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('my own onion')
	})

	test.each(['/recipes', '/recipes/new'])(
		'sorts a recipe pasted into the one box from %s, once',
		async (path) => {
			const { router, screen } = await renderRoute({
				path,
				session: testSession,
			})

			await router.navigate({
				to: '/recipes/new',
				state: {
					pasted:
						'weeknight dal\ningredients\n1 cup red lentils\nmethod\n1. simmer\nnotes\nserve warm',
				},
			})

			await expect
				.element(screen.getByRole('textbox', { name: 'name' }))
				.toHaveValue('weeknight dal')
			await expect
				.element(screen.getByRole('textbox', { name: 'Step 1' }))
				.toHaveValue('simmer')

			// The page forgets it, so a reload starts blank instead of a second draft.
			await expect
				.poll(() => router.state.location.state.pasted)
				.toBeUndefined()
			await screen.getByRole('button', { name: 'undo' }).click()
			await expect
				.element(screen.getByRole('textbox', { name: 'name' }))
				.toHaveValue('')
			await expect
				.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
				.toHaveValue('')
			expect(state.created).toEqual([])
			expect(state.deleted).toEqual([])
		},
	)

	test('keeps unsaved edits when another recipe arrives from the finder', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('My pasta')
		await screen.getByRole('combobox', { name: 'Ingredient 1' }).fill('1 onion')
		await userEvent.keyboard('{Escape}')
		await screen.getByRole('textbox', { name: 'Step 1' }).fill('Chop')

		await router.navigate({
			to: '/recipes/new',
			state: { pasted: 'dal\ningredients\n1 cup lentils\nmethod\n1. simmer' },
		})
		await expect
			.element(screen.getByText('start with an empty recipe to paste text'))
			.toBeVisible()
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('My pasta')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('1 onion')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 1' }))
			.toHaveValue('Chop')
		await expect.poll(() => router.state.location.state.pasted).toBeUndefined()
		expect(state.created).toEqual([])
	})

	test('writes each ingredient as one line, finishing the food from a suggestion', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		const first = screen.getByRole('combobox', { name: 'Ingredient 1' })
		await first.fill('1 1/2 cups flo')
		await screen.getByRole('option', { name: 'flour' }).click()
		await expect.element(first).toHaveValue('1 1/2 cups flour')

		await userEvent.keyboard('[Enter]')
		await userEvent.keyboard('a knob of butter')

		// Kept as written: no unit list to fit, no decimals to read.
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.ingredients)
			.toEqual(['1 1/2 cups flour', 'a knob of butter'])
	})

	test('moves on to the ingredients with Enter in the name, saving nothing', async () => {
		const { screen, router } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveFocus()
		expect(router.state.location.pathname).toBe('/recipes/new')
		expect(state.created.some((saved) => saved.finalized)).toBe(false)
	})

	test('asks before cancel throws away changes', async () => {
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

		const { screen, router } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('button', { name: 'cancel' }).click()
		expect(confirm).toHaveBeenCalled()
		expect(router.state.location.pathname).toBe('/recipes/new')

		confirm.mockReturnValue(true)
		await screen.getByRole('button', { name: 'cancel' }).click()
		await expect.poll(() => router.state.location.pathname).toBe('/recipes')
		confirm.mockRestore()
	})

	test('offers recipes to start from only once the name finds some', async () => {
		online.results = []

		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const name = screen.getByRole('textbox', { name: 'name' })
		await name.fill('roman pasta')
		await expect
			.element(
				screen.getByText('or paste a link or a whole recipe into the name'),
			)
			.not.toBeInTheDocument()
		// Nothing found, nothing offered.
		await new Promise((resolve) => setTimeout(resolve, 600))
		await expect
			.element(screen.getByRole('button', { name: /start from a recipe like/ }))
			.not.toBeInTheDocument()

		online.results = [
			{ recipeId: 'shared-1', title: 'Cacio e pepe', siteName: 'Example' },
		]
		await name.fill('cacio e pepe')
		await screen
			.getByRole('button', { name: /start from a recipe like “cacio e pepe”/ })
			.click()

		// The same search as anywhere else, holding the name, without the ways
		// to start a new recipe: this one is already being written.
		const finder = page.getByRole('dialog', { name: 'find a recipe' })
		await expect
			.element(finder.getByRole('combobox', { name: 'find a recipe' }))
			.toHaveValue('cacio e pepe')
		await expect
			.element(finder.getByRole('option', { name: /Cacio e pepe/ }))
			.toBeVisible()
		await expect
			.element(finder.getByRole('option', { name: /start a blank recipe/ }))
			.not.toBeInTheDocument()
		online.results = []
	})

	test('starts from a recipe found online, with undo', async () => {
		online.results = [
			{
				recipeId: 'shared-1',
				title: 'Chicken tikka masala',
				siteName: 'Example',
			},
		]
		online.recipe = {
			id: 'shared-1',
			title: 'Chicken tikka masala',
			sourceUrl: 'https://example.com/tikka',
			ingredients: ['1 lb chicken thighs', '1 cup yogurt'],
			steps: ['marinate the chicken'],
		}

		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('tikka masala')
		await screen
			.getByRole('button', { name: /start from a recipe like/ })
			.click()

		const finder = page.getByRole('dialog', { name: 'find a recipe' })
		await finder.getByRole('option', { name: /Chicken tikka masala/ }).click()
		await expect.element(finder.getByText(/chicken thighs/)).toBeVisible()
		// Picked here, a recipe is used, not saved or opened.
		await expect
			.element(finder.getByRole('button', { name: 'save', exact: true }))
			.not.toBeInTheDocument()
		await expectIsolatedScreenshot(finder, 'start-from-preview')
		await finder.getByRole('button', { name: 'use this recipe' }).click()

		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('1 lb chicken thighs')
		await expect.element(finder).not.toBeInTheDocument()
		// The cook's name stays; the original is credited.
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('tikka masala')
		await expect
			.element(screen.getByRole('button', { name: 'edit original link' }))
			.toBeVisible()

		// Undo puts the name back as it was too, even when it changed since.
		await screen.getByRole('textbox', { name: 'name' }).fill('curry')
		await screen.getByRole('button', { name: 'undo' }).click()
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('')
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toHaveValue('tikka masala')
		await expect
			.element(
				screen.getByRole('button', {
					name: /start from a recipe like “tikka masala”/,
				}),
			)
			.toBeVisible()
		online.results = []
		online.recipe = null
	})

	test('reads the amount as it is typed, in its short form', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		const line = screen.getByRole('combobox', { name: 'Ingredient 1' })
		await line.click()
		await userEvent.keyboard('1 tablespoon butter')
		await userEvent.keyboard('{Escape}')
		await expect.element(line).toHaveValue('1 tbsp butter')
		await expectIsolatedScreenshot(
			screen.getByRole('list', { name: 'ingredient lines' }),
			'ingredient-amount-typed',
		)
	})

	test('splits a line at the caret with Enter', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen
			.getByRole('combobox', { name: 'Ingredient 1' })
			.fill('2 eggs 1 cup milk')
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('{ArrowLeft>10/}{Enter}')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('2 eggs')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
			.toHaveFocus()

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.ingredients)
			.toEqual(['2 eggs', '1 cup milk'])
	})

	test('makes a line ending in a colon a group', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('combobox', { name: 'Ingredient 1' }).click()
		await userEvent.keyboard('for the topping:')
		await userEvent.keyboard('{Escape}')
		await userEvent.keyboard('[Enter]')
		await expect
			.element(screen.getByRole('textbox', { name: 'Section name 1' }))
			.toHaveValue('for the topping')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
			.toHaveFocus()
		await userEvent.keyboard('butter')

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.ingredients)
			.toEqual(['## for the topping', 'butter'])
	})

	test('keeps a group label in a pasted list as a group', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		const first = screen.getByRole('combobox', { name: 'Ingredient 1' })
		first.element().focus()

		const data = new DataTransfer()
		data.setData('text', '2 slices bread\nfor the topping:\n- 1 tbsp butter')
		first.element().dispatchEvent(
			new ClipboardEvent('paste', {
				clipboardData: data,
				bubbles: true,
				cancelable: true,
			}),
		)

		await expect
			.element(screen.getByRole('textbox', { name: 'Section name 2' }))
			.toHaveValue('for the topping')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.ingredients)
			.toEqual(['2 slices bread', '## for the topping', '1 tbsp butter'])
	})

	test('moves a step with the keyboard', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('textbox', { name: 'Step 1' }).fill('butter it')
		await userEvent.keyboard('[Enter]')
		await userEvent.keyboard('toast it')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 1' }))
			.toHaveValue('butter it')

		screen.getByRole('button', { name: 'Move step 2' }).element().focus()
		await userEvent.keyboard('[Space]')
		await userEvent.keyboard('[ArrowUp]')
		await userEvent.keyboard('[Space]')

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(() => latest()?.steps).toEqual(['toast it', 'butter it'])
	})

	test('moves a step with its sub-steps from its handle', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('textbox', { name: 'Step 1' }).fill('toast it')
		await userEvent.keyboard('[Enter]')
		await userEvent.keyboard('make the butter')
		await userEvent.keyboard('[Enter]')
		await userEvent.keyboard('soften it')
		await screen.getByRole('button', { name: 'Make step 3 a sub-step' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 2.1' }))
			.toHaveValue('soften it')

		// Every written step has its handle, with no mode to switch into: the
		// row in hand shows it.
		await screen.getByRole('textbox', { name: 'Step 2', exact: true }).click()
		const stepList = screen.getByRole('group', { name: 'steps' })
		stepList.element().scrollIntoView({ block: 'center', behavior: 'instant' })
		await Promise.all(
			document.getAnimations().map((animation) => animation.finished),
		)
		await expectIsolatedScreenshot(stepList, 'steps-handles')
		screen.getByRole('button', { name: 'Move step 2' }).element().focus()
		await userEvent.keyboard('[Space]')
		// Steps fold to themselves while one is carried.
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 2.1' }))
			.not.toBeInTheDocument()
		await userEvent.keyboard('[ArrowUp]')
		// A move toward the top of the page may scroll first; drop once it lands.
		await expect
			.element(screen.getByText('step 2 moved to position 1 of 2'))
			.toBeInTheDocument()
		await userEvent.keyboard('[Space]')

		await expect
			.element(screen.getByRole('textbox', { name: 'Step 1.1' }))
			.toHaveValue('soften it')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.steps)
			.toEqual(['make the butter', '- soften it', 'toast it'])
	})

	test('starts the next step on enter and skips empty ones', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen
			.getByRole('textbox', { name: 'Step 1' })
			.fill('slice the bread')
		await userEvent.keyboard('[Enter]')
		await userEvent.keyboard('toast it')
		await userEvent.keyboard('[Enter]')
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 3' }))
			.toHaveFocus()
		// Left blank, the new step goes once the cook moves on.
		await screen.getByRole('textbox', { name: 'name' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'Step 3' }))
			.not.toBeInTheDocument()

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.steps)
			.toEqual(['slice the bread', 'toast it'])
	})

	test('splits a pasted numbered method into steps', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		screen.getByRole('textbox', { name: 'Step 1' }).element().focus()

		const data = new DataTransfer()
		data.setData('text', '1. slice the bread\n2. toast it\n\n3) butter it')
		screen
			.getByRole('textbox', { name: 'Step 1' })
			.element()
			.dispatchEvent(
				new ClipboardEvent('paste', {
					clipboardData: data,
					bubbles: true,
					cancelable: true,
				}),
			)

		await expect
			.element(screen.getByRole('textbox', { name: 'Step 3' }))
			.toHaveValue('butter it')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.steps)
			.toEqual(['slice the bread', 'toast it', 'butter it'])
	})

	test('uploads a photo and saves its key with the recipe', async () => {
		const realFetch = globalThis.fetch.bind(globalThis)

		vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
			new Request(input).url.startsWith('https://storage.test/')
				? Promise.resolve(new Response(null, { status: 200 }))
				: realFetch(input, init),
		)

		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await userEvent.upload(
			screen.getByLabelText('Recipe photo'),
			new File(['x'], 'toast.png', { type: 'image/png' }),
		)
		await expect
			.element(screen.getByRole('button', { name: 'Remove photo' }))
			.toBeVisible()

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(() => latest()?.imageUrl).toBe('recipes/user-1-photo')
	})

	test('reports a rejected photo upload with the storage error', async () => {
		const realFetch = globalThis.fetch.bind(globalThis)

		vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
			new Request(input).url.startsWith('https://storage.test/')
				? Promise.resolve(
						new Response('<Error><Code>NoSuchBucket</Code></Error>', {
							status: 404,
						}),
					)
				: realFetch(input, init),
		)

		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await userEvent.upload(
			screen.getByLabelText('Recipe photo'),
			new File(['x'], 'toast.png', { type: 'image/png' }),
		)
		await expect
			.element(screen.getByText("couldn't upload that photo — try again"))
			.toBeVisible()
		expect(sentry.captureException).toHaveBeenCalledOnce()
		expect(sentry.captureException).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringMatching(/404.*NoSuchBucket/),
			}),
			{
				tags: { upload: 'recipe-photo' },
				extra: { type: 'image/png', size: 1 },
			},
		)
	})

	test('does not finish on Enter while a photo upload is pending', async () => {
		let finishUpload: (response: Response) => void = () => {}

		const upload = new Promise<Response>((resolve) => {
			finishUpload = resolve
		})

		const realFetch = globalThis.fetch.bind(globalThis)
		vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
			new Request(input).url.startsWith('https://storage.test/')
				? upload
				: realFetch(input, init),
		)

		const { screen, router } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		const name = screen.getByRole('textbox', { name: 'name' })
		await name.fill('Toast')
		expect(state.created).toHaveLength(0)
		await userEvent.upload(
			screen.getByLabelText('Recipe photo'),
			new File(['x'], 'toast.png', { type: 'image/png' }),
		)
		await expect
			.element(screen.getByRole('button', { name: 'save' }))
			.toBeDisabled()
		await name.click()
		await userEvent.keyboard('{Enter}')
		expect(router.state.location.pathname).toBe('/recipes/new')
		expect(state.updated.some((saved) => saved.finalize)).toBe(false)
		finishUpload(new Response(null, { status: 200 }))
		await expect
			.element(screen.getByRole('button', { name: 'Remove photo' }))
			.toBeVisible()
		await screen.getByRole('button', { name: 'save' }).click()
		await expect
			.poll(() => state.created.find((saved) => saved.finalized)?.imageUrl)
			.toBe('recipes/user-1-photo')
	})

	test('asks guests to create an account before writing', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: {
				...testSession,
				user: { ...testSession.user, isAnonymous: true },
			},
		})

		await expect
			.element(screen.getByRole('dialog', { name: 'create an account' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('textbox', { name: 'original link' }))
			.not.toBeInTheDocument()
	})

	describe('suggested sections', () => {
		test('offers a spice blend for chili as a chip, and adds it whole', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: testSession,
			})

			await screen
				.getByRole('textbox', { name: 'name' })
				.fill('Weeknight chili')

			const blend = screen.getByRole('button', {
				name: 'suggested spice blend',
			})

			// The name settles before it is asked about.
			await expect.element(blend, { timeout: 4000 }).toBeVisible()
			await expect
				.element(screen.getByRole('button', { name: 'suggested toppings' }))
				.toBeVisible()
			await blend.click()

			const lines = screen.getByRole('region', {
				name: 'suggested spice blend lines',
			})

			await expect.element(lines).toBeVisible()
			// One way in: the whole section, never a line at a time.
			await expect
				.element(lines.getByRole('button', { name: /^Add / }))
				.not.toBeInTheDocument()
			const panel = screen.getByLabelText('suggestions')
			panel.element().scrollIntoView({ block: 'center', behavior: 'instant' })
			await expectIsolatedScreenshot(panel, 'ingredient-suggestions')

			await lines.getByRole('button', { name: 'add these 6' }).click()

			await expect
				.element(screen.getByRole('textbox', { name: 'Section name 1' }))
				.toHaveValue('spice blend')
			await expect
				.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
				.toHaveValue('3 tbsp chili powder')
			await expect.element(blend).not.toBeInTheDocument()
			await screen.getByRole('button', { name: 'save', exact: true }).click()
			await expect
				.poll(() => latest()?.ingredients?.slice(0, 2))
				.toEqual(['## spice blend', '3 tbsp chili powder'])
		})

		test('skips foods already written and keeps a waved-off section away', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: testSession,
			})

			await screen.getByRole('combobox', { name: 'Ingredient 1' }).fill('cumin')
			await screen.getByRole('textbox', { name: 'name' }).fill('chili')
			await screen
				.getByRole('button', { name: 'suggested spice blend' })
				.click()
			await expect.element(screen.getByText('dried oregano')).toBeVisible()
			await expect
				.element(screen.getByText('ground cumin'))
				.not.toBeInTheDocument()

			await screen.getByRole('button', { name: 'suggested toppings' }).click()
			await screen.getByRole('button', { name: 'no thanks' }).click()
			await screen.getByRole('textbox', { name: 'name' }).fill('beef chili')

			await expect
				.element(screen.getByRole('button', { name: 'suggested spice blend' }))
				.toBeVisible()
			await expect
				.element(screen.getByRole('button', { name: 'suggested toppings' }))
				.not.toBeInTheDocument()
		})

		test('brings waved-off sections back from one chip', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: testSession,
			})

			await screen.getByRole('textbox', { name: 'name' }).fill('chili')
			await screen.getByRole('button', { name: 'suggested toppings' }).click()
			await screen.getByRole('button', { name: 'no thanks' }).click()
			await expect
				.element(screen.getByRole('button', { name: 'suggested toppings' }))
				.not.toBeInTheDocument()

			await screen.getByRole('button', { name: '1 hidden' }).click()

			await expect
				.element(screen.getByRole('button', { name: 'suggested toppings' }))
				.toBeVisible()
		})

		test('suggests lines inside a section the cook names', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: testSession,
			})

			await screen.getByRole('textbox', { name: 'name' }).fill('toast')
			await screen.getByRole('combobox', { name: 'Ingredient 1' }).fill('bread')
			await userEvent.keyboard('{Escape}')
			await screen.getByRole('button', { name: 'add section' }).click()
			await expect
				.element(screen.getByRole('textbox', { name: 'Section name 2' }))
				.toHaveFocus()
			// One empty card at a time.
			await expect
				.element(screen.getByRole('button', { name: 'add section' }))
				.toBeDisabled()
			await userEvent.keyboard('dressing')
			await expect
				.element(
					screen.getByText('olive oil, red wine vinegar, dijon mustard +1'),
				)
				.toBeVisible()
			await screen.getByRole('button', { name: 'add 4' }).click()
			await expect
				.element(screen.getByRole('combobox', { name: 'Ingredient 3' }))
				.toHaveValue('3 tbsp olive oil')
			await screen.getByRole('button', { name: 'save', exact: true }).click()
			await expect
				.poll(() => latest()?.ingredients?.slice(0, 3))
				.toEqual(['bread', '## dressing', '3 tbsp olive oil'])
		})

		test('suggests nothing for a dish it does not know', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/new',
				session: testSession,
			})

			await screen.getByRole('textbox', { name: 'name' }).fill('toast')
			await expect
				.element(screen.getByRole('textbox', { name: 'name' }))
				.toHaveValue('toast')
			await expect
				.element(screen.getByLabelText('suggestions'))
				.not.toBeInTheDocument()
		})
	})
})
