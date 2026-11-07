import { getAuthMocks, setMockSession } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

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

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: () => Promise.resolve(null),
	copyRecipe: () => Promise.resolve(null),
	saveRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [] }),
	getRecipe: () => Promise.resolve(null),
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
		await expect.element(screen.getByText('changed: name')).toBeVisible()
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

		await screen
			.getByRole('button', { name: 'paste text', exact: true })
			.click()
		const dialog = screen.getByRole('dialog', { name: 'paste a recipe' })
		const longNotes = 'a'.repeat(2001)
		await dialog
			.getByRole('textbox', { name: 'recipe text' })
			.fill(
				`Toast\nIngredients\n2 slices bread\nSteps\nToast.\nNotes\n${longNotes}`,
			)
		await dialog.getByRole('button', { name: 'add recipe' }).click()
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

	test('sorts text pasted into the recipe dialog', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen
			.getByRole('button', { name: 'paste text', exact: true })
			.click()
		const dialog = screen.getByRole('dialog', { name: 'paste a recipe' })
		await expect
			.element(dialog.getByRole('button', { name: 'add recipe' }))
			.toBeDisabled()
		await dialog
			.getByRole('textbox', { name: 'recipe text' })
			.fill(
				'Toast\nIngredients\n2 slices bread\nSteps\nToast the bread.\nNotes\nUse fresh bread.',
			)
		await dialog.getByRole('button', { name: 'add recipe' }).click()
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

	test('offers import from the empty editor and keeps the editor when cancelled', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await expect
			.element(
				screen.getByRole('button', { name: 'blank recipe', exact: true }),
			)
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('button', { name: 'paste text', exact: true }))
			.toBeVisible()
		await screen
			.getByRole('button', { name: 'import link', exact: true })
			.click()
		await expect
			.element(screen.getByRole('dialog', { name: 'import a recipe' }))
			.toBeVisible()
		await userEvent.keyboard('{Escape}')
		await expect
			.element(screen.getByRole('textbox', { name: 'name' }))
			.toBeVisible()
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

	test('groups ingredients under a section heading', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/new',
			session: testSession,
		})

		await screen.getByRole('textbox', { name: 'name' }).fill('Toast')
		await screen.getByRole('combobox', { name: 'Ingredient 1' }).fill('bread')
		// The suggestions would sit over the button.
		await userEvent.keyboard('{Escape}')
		await screen.getByRole('button', { name: 'add section' }).click()
		await userEvent.keyboard('for the topping')
		await userEvent.keyboard('[Enter]')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 3' }))
			.toHaveFocus()
		await userEvent.keyboard('butter')

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => latest()?.ingredients)
			.toEqual(['bread', '## for the topping', 'butter'])
	})

	test('keeps a group label in a pasted list as a section', async () => {
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
			.element(screen.getByRole('textbox', { name: 'Section heading 2' }))
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

		screen.getByRole('button', { name: 'Reorder step 2' }).element().focus()
		await userEvent.keyboard('[Space]')
		await userEvent.keyboard('[ArrowUp]')
		await userEvent.keyboard('[Space]')

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(() => latest()?.steps).toEqual(['toast it', 'butter it'])
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
})
