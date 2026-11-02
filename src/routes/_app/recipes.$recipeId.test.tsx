import { renderRoute } from '@tests/support/render/route'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { userEvent } from 'vitest/browser'

import type { getCooking, updateCooking } from '@/lib/cooking/server'
import type { getRecipe } from '@/lib/recipes/server'

type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

const recipeState: { recipe: Recipe | null } = vi.hoisted(() => ({
	recipe: null,
}))

type RecipeUpdate = Omit<
	Recipe,
	'userId' | 'collectionId' | 'imageUrl' | 'sourceUrl' | 'createdAt'
> & { imageUrl?: string | null | undefined; finalize?: boolean | undefined }

const updateCalls = vi.hoisted(() => {
	const calls: RecipeUpdate[] = []
	const deleted: string[] = []
	const saved: string[] = []

	return { calls, deleted, saved }
})

const cookingState = vi.hoisted<{
	progress: Awaited<ReturnType<typeof getCooking>>
	checkGate: Promise<void> | null
	failCheck: boolean
	finishGate: Promise<void> | null
	failFinish: boolean
}>(() => ({
	progress: null,
	checkGate: null,
	failCheck: false,
	finishGate: null,
	failFinish: false,
}))

vi.mock('@/lib/cooking/server', () => ({
	listActiveCooking: () =>
		Promise.resolve(
			cookingState.progress?.active
				? [{ ...cookingState.progress, title: 'Pasta', steps: 1 }]
				: [],
		),
	getCooking: () => Promise.resolve(cookingState.progress),
	updateCooking: async ({ data }: Parameters<typeof updateCooking>[0]) => {
		if (data.action === 'check') {
			await cookingState.checkGate

			if (cookingState.failCheck) throw new Error('Could not save check')
		}

		if (data.action === 'finish') {
			await cookingState.finishGate

			if (cookingState.failFinish) throw new Error('Could not end cooking')
			cookingState.progress = null

			return null
		}

		const current = cookingState.progress ?? {
			userId: 'user-1',
			recipeId: data.recipeId,
			active: false,
			checked: [],
			content: '',
			startedAt: new Date(),
			updatedAt: new Date(),
		}

		const checked = new Set(current.checked)

		if (data.item) {
			if (data.done) checked.add(data.item)
			else checked.delete(data.item)
		}

		cookingState.progress = {
			...current,
			active: data.action !== 'pause',
			checked: [...checked],
		}

		return cookingState.progress
	},
}))

vi.mock('@/lib/recipes/server', () => ({
	listShelf: () => Promise.resolve({ recipes: [], collections: [] }),
	getRecipe: () => Promise.resolve(recipeState.recipe),
	updateRecipe: async ({ data }: { data: RecipeUpdate }) => {
		updateCalls.calls.push(data)

		if (recipeState.recipe) {
			const { finalize, imageUrl, ...rest } = data

			Object.assign(recipeState.recipe, rest)

			if (imageUrl !== undefined) recipeState.recipe.imageUrl = imageUrl

			if (finalize) recipeState.recipe.finalizedAt = new Date()
		}

		// A shared recipe's first edit comes back as the user's own copy.
		return { id: recipeState.recipe?.owned === false ? 'recipe-copy' : data.id }
	},
	createRecipe: vi.fn(),
	saveRecipe: async ({ data }: { data: { id: string } }) => {
		updateCalls.saved.push(data.id)

		if (recipeState.recipe)
			recipeState.recipe = { ...recipeState.recipe, saved: true }

		return recipeState.recipe
	},
	createBook: vi.fn(),
	renameBook: vi.fn(),
	deleteBook: vi.fn(),
	listBooks: () => Promise.resolve([{ id: 'col-1', name: 'weeknight' }]),
	moveRecipe: async ({
		data,
	}: {
		data: { id: string; collectionId: string | null }
	}) => {
		if (recipeState.recipe) {
			recipeState.recipe = {
				...recipeState.recipe,
				collectionId: data.collectionId,
			}
		}
	},
	deleteRecipe: async ({ data }: { data: { id: string } }) => {
		updateCalls.deleted.push(data.id)

		if (recipeState.recipe && !recipeState.recipe.owned)
			recipeState.recipe = {
				...recipeState.recipe,
				saved: false,
				collectionId: null,
			}
	},
}))

vi.mock('@/lib/s3', () => ({
	getRecipePhotoUploadUrl: () =>
		Promise.resolve({
			key: 'recipes/user-1-photo',
			url: 'https://storage.test/upload',
		}),
}))

const session = {
	user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
	session: { id: 'session-1', token: 'token' },
}

describe('recipe detail', () => {
	beforeEach(() => {
		// A toast left over from the last test would cover the pinned actions.
		toast.dismiss()
		cookingState.progress = null
		cookingState.checkGate = null
		cookingState.failCheck = false
		cookingState.finishGate = null
		cookingState.failFinish = false
		updateCalls.calls.length = 0
		updateCalls.deleted.length = 0
		updateCalls.saved.length = 0
		recipeState.recipe = {
			id: 'recipe-1',
			userId: 'user-1',
			collectionId: null,
			title: 'miso butter pasta',
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
			saved: true,
			owned: true,
			ingredients: [],
			steps: [],
		}
	})

	test('renders content and separate empty states', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200g pasta', '1 tbsp miso']
		recipeState.recipe.steps = ['boil the pasta', 'stir in the miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect.element(screen.getByText('200g pasta')).toBeVisible()
		await expect.element(screen.getByText('boil the pasta')).toBeVisible()
	})

	test('shows placeholders when content is empty', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect.element(screen.getByText('no ingredients yet')).toBeVisible()
		await expect.element(screen.getByText('no steps yet')).toBeVisible()
	})

	test('aligns ingredient starts and switches between category and recipe order', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'200g pasta',
			'2 large eggs',
			'⅓ cup flour',
			'salt to taste',
		]
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByText('dairy & eggs', { exact: true }))
			.toBeVisible()

		const left = (text: string) =>
			screen.getByText(text, { exact: true }).element().getBoundingClientRect()
				.left

		expect(Math.abs(left('200g pasta') - left('⅓ cup flour'))).toBeLessThan(1)
		await screen
			.getByRole('button', { name: 'recipe order', exact: true })
			.click()
		await expect
			.element(screen.getByText('dairy & eggs', { exact: true }))
			.not.toBeInTheDocument()
	})

	test('keeps mixed fractions and dual-unit amounts visible in an indented list', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'## Ingredients',
			'1 large onion - diced',
			'4 large garlic cloves - diced',
			'1 ½ tablespoons dried mint',
			'1 1/2 teaspoons turmeric powder',
			'½ cup dried chickpeas soaked overnight (or 1 cup canned chickpeas)',
			'12oz / 340g fresh spinach',
			'4oz / 120g reshteh noodles (or dried udon noodles / linguine)',
			'½ cup liquid kashk mixture',
			'2 tablespoons extra virgin olive oil',
			'Salt and black pepper to taste',
		]
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		for (const amount of [
			'1 ½ tablespoons dried mint',
			'1 1/2 teaspoons turmeric powder',
			'12oz / 340g fresh spinach',
			'4oz / 120g reshteh noodles (or dried udon noodles / linguine)',
		]) {
			const element = screen.getByText(amount, { exact: true }).element()
			expect(element.getBoundingClientRect().width).toBeGreaterThan(0)
			expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
				window.innerWidth - 16,
			)
		}

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		)
	})

	test('shows a heading line as a group label, not a checkbox', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['## for the sauce', '1 tbsp miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect
			.element(screen.getByText('for the sauce'))
			.not.toBeInTheDocument()
		await screen
			.getByRole('button', { name: 'recipe order', exact: true })
			.click()
		await expect.element(screen.getByText('for the sauce')).toBeVisible()
		await expect
			.element(screen.getByText('## for the sauce'))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByText('1 tbsp miso', { exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: /for the sauce/ }))
			.not.toBeInTheDocument()
	})

	test('saves edited ingredients and free-form steps', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta']
		recipeState.recipe.steps = ['boil the pasta']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'add ingredient' }).click()
		await screen
			.getByRole('combobox', { name: 'Ingredient 2' })
			.fill('2 tbsp butter')
		// The suggestions would sit over the button.
		await userEvent.keyboard('{Escape}')
		await screen.getByRole('button', { name: 'add step' }).click()
		await screen
			.getByRole('textbox', { name: 'Step 2' })
			.fill('stir in the butter')
		await screen.getByRole('button', { name: 'done' }).click()

		await expect.element(screen.getByText('2 tbsp butter')).toBeVisible()
		await expect.element(screen.getByText('stir in the butter')).toBeVisible()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['200 g pasta', '2 tbsp butter'],
			steps: ['boil the pasta', 'stir in the butter'],
		})
		expect(updateCalls.calls.at(-1)?.finalize).toBeUndefined()
	})

	test('reorders ingredients from the drag handle and removes rows', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta', '1 tbsp miso', '1 onion']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		screen
			.getByRole('button', { name: 'Reorder ingredient 2' })
			.element()
			.focus()
		await userEvent.keyboard('[Space]')
		await userEvent.keyboard('[ArrowUp]')
		await userEvent.keyboard('[Space]')
		await screen.getByRole('button', { name: 'Remove ingredient 3' }).click()
		await screen.getByRole('button', { name: 'done' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['1 tbsp miso', '200 g pasta'],
		})
	})

	test('keeps an imported photo unless it is changed', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.imageUrl = '/sprites/pantry/apple.png'

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('notes').fill('crispier')
		await screen.getByRole('button', { name: 'done' }).click()
		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)?.imageUrl).toBeUndefined()

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'Remove photo' }).click()
		await expect
			.element(screen.getByLabelText('Recipe photo'))
			.toBeInTheDocument()
		await screen.getByRole('button', { name: 'done' }).click()
		await expect.poll(() => updateCalls.calls.at(-1)?.imageUrl).toBeNull()
	})

	test('uploads a photo for a recipe without one', async () => {
		const realFetch = globalThis.fetch.bind(globalThis)

		vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
			new Request(input).url.startsWith('https://storage.test/')
				? Promise.resolve(new Response(null, { status: 200 }))
				: realFetch(input, init),
		)

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await userEvent.upload(
			screen.getByLabelText('Recipe photo'),
			new File(['x'], 'pasta.png', { type: 'image/png' }),
		)
		await expect
			.element(screen.getByRole('button', { name: 'Remove photo' }))
			.toBeVisible()
		await screen.getByRole('button', { name: 'done' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)?.imageUrl).toBe('recipes/user-1-photo')
	})

	test('saves edits as you type, without a save button', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.not.toBeInTheDocument()
		await screen.getByLabelText('notes').fill('more lemon')

		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({ notes: 'more lemon' })
		await expect
			.element(screen.getByText('saved', { exact: true }))
			.toBeVisible()
	})

	test('opens a draft in the editor and finalizes it', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.finalizedAt = null
		recipeState.recipe.ingredients = ['⅓ cup flour', '⅛ tsp salt']
		recipeState.recipe.steps = ['boil the pasta']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect.element(screen.getByText('draft · saved')).toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'cancel' }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'done' }).click()

		await expect
			.element(screen.getByText('⅓ cup flour', { exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'edit' }))
			.toBeVisible()
		expect(updateCalls.calls.at(-1)?.finalize).toBe(true)
	})

	test('starts cooking directly from the start button', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['1 carrot']
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen
			.getByRole('button', { name: 'start cooking', exact: true })
			.click()
		await expect
			.element(screen.getByRole('button', { name: 'end cooking' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('dialog', { name: 'Start cooking?' }))
			.not.toBeInTheDocument()
		expect(cookingState.progress?.active).toBe(true)
	})

	test('ends cooking immediately and restores the session if saving fails', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['1 carrot']
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen
			.getByRole('button', { name: 'start cooking', exact: true })
			.click()
		await expect
			.element(screen.getByRole('button', { name: 'end cooking' }))
			.toBeVisible()
		await expect
			.poll(
				() => document.querySelector('[aria-label="Cooking tracker"]') !== null,
			)
			.toBe(true)
		let release: () => void = () => {}

		cookingState.finishGate = new Promise<void>((resolve) => {
			release = resolve
		})
		cookingState.failFinish = true
		await screen.getByRole('button', { name: 'end cooking' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'end cooking' }))
			.not.toBeInTheDocument()
		await expect
			.poll(() => document.querySelector('[aria-label="Cooking tracker"]'))
			.toBeNull()
		expect(cookingState.progress?.active).toBe(true)
		release()
		await expect
			.element(screen.getByText('Could not end cooking'))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'end cooking' }))
			.toBeVisible()
		await expect
			.poll(
				() => document.querySelector('[aria-label="Cooking tracker"]') !== null,
			)
			.toBe(true)
		cookingState.failFinish = false
		cookingState.finishGate = null
		await screen.getByRole('button', { name: 'end cooking' }).click()
		await expect.poll(() => cookingState.progress).toBeNull()
	})

	test('starts from a checklist confirmation, persists checks, and finishes', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.owned = false
		recipeState.recipe.userId = null
		recipeState.recipe.saved = false
		recipeState.recipe.ingredients = ['1 tbsp olive oil', '200g pasta']
		recipeState.recipe.steps = ['Boil pasta']

		const { screen, router } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		const start = screen.getByRole('button', {
			name: 'start cooking',
			exact: true,
		})

		await expect.element(start).toBeEnabled()
		expect(
			document.querySelector('img[src="/sprites/pantry/olive-oil.png"]'),
		).not.toBeNull()

		const save = screen.getByRole('button', {
			name: 'save to shelf',
			exact: true,
		})

		expect(start.element().getBoundingClientRect().height).toBe(
			save.element().getBoundingClientRect().height,
		)
		expect(start.element().getBoundingClientRect().top).toBe(
			save.element().getBoundingClientRect().top,
		)
		expect(cookingState.progress).toBeNull()
		const checkbox = screen.getByRole('checkbox').first()
		await checkbox.click()
		await expect.element(screen.getByRole('dialog')).toBeVisible()
		expect(cookingState.progress).toBeNull()
		await screen.getByRole('button', { name: 'cancel', exact: true }).click()
		await expect.element(checkbox).not.toBeChecked()
		await checkbox.click()
		await screen
			.getByRole('dialog')
			.getByRole('button', { name: 'start cooking', exact: true })
			.click()
		await expect.poll(() => cookingState.progress?.checked.length).toBe(1)
		await expect
			.poll(
				() =>
					document.querySelector('[aria-label="elapsed cooking time"]') !==
					null,
			)
			.toBe(true)

		let release: () => void = () => {}

		cookingState.checkGate = new Promise<void>((resolve) => {
			release = resolve
		})
		const step = screen.getByRole('checkbox', { name: /Boil pasta/ })
		await step.click()
		await expect.element(step).toBeChecked()
		await expect.element(step).toBeEnabled()
		expect(
			document.querySelector('[aria-label="Cooking tracker"]')?.textContent,
		).toContain('1/1 steps')
		expect(cookingState.progress?.checked).not.toContain('s0')
		await step.click()
		await expect.element(step).not.toBeChecked()
		expect(
			document.querySelector('[aria-label="Cooking tracker"]')?.textContent,
		).toContain('0/1 steps')
		release()
		await expect
			.poll(() =>
				screen
					.getByRole('button', { name: 'end cooking', exact: true })
					.element()
					.hasAttribute('disabled'),
			)
			.toBe(false)
		cookingState.checkGate = null
		cookingState.failCheck = true
		await step.click()
		await expect.element(screen.getByText('Could not save check')).toBeVisible()
		await expect.element(step).not.toBeChecked()
		cookingState.failCheck = false
		await router.navigate({
			to: '/coming-soon/$feature',
			params: { feature: 'groceries' },
		})
		await expect
			.element(screen.getByRole('heading', { name: /groceries/i }))
			.toBeVisible()
		expect(
			document.querySelector('[aria-label="elapsed cooking time"]'),
		).not.toBeNull()
		await router.navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: 'recipe-1' },
		})
		await expect
			.element(
				screen.getByRole('checkbox', { name: '200g pasta', exact: true }),
			)
			.toBeChecked()
		await screen
			.getByRole('button', { name: 'end cooking', exact: true })
			.click()
		await expect.poll(() => cookingState.progress).toBeNull()
	})

	test('edits the name and notes without asking for servings or time', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('name').fill('brown butter pasta')
		await expect
			.element(screen.getByLabelText('servings'))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByLabelText('total minutes'))
			.not.toBeInTheDocument()
		await screen.getByLabelText('notes').fill('more lemon')
		await screen.getByRole('button', { name: 'done' }).click()

		await expect
			.element(screen.getByRole('heading', { name: 'brown butter pasta' }))
			.toBeVisible()
		await expect.element(screen.getByText('more lemon')).toBeVisible()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			title: 'brown butter pasta',
			notes: 'more lemon',
		})
	})

	test('links to the site a recipe was imported from', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceUrl = 'https://www.example.com/miso-pasta'

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect
			.element(screen.getByRole('link', { name: 'from example.com' }))
			.toHaveAttribute('href', 'https://www.example.com/miso-pasta')
	})

	test('shows the logo of a known source site', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceUrl = 'https://www.bbcgoodfood.com/recipes/dal'

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		const link = screen.getByRole('link', { name: 'from bbcgoodfood.com' })

		await expect
			.element(link)
			.toHaveAttribute('href', recipeState.recipe.sourceUrl)
		expect(link.element().querySelector('img')?.getAttribute('src')).toBe(
			'/import-sites/bbcgoodfood.png',
		)
	})

	test('deletes only after confirming', async () => {
		const { router, screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		await screen.getByRole('button', { name: 'keep it' }).click()
		expect(updateCalls.deleted).toEqual([])

		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		await screen.getByRole('button', { name: 'really delete' }).click()

		await expect.poll(() => router.state.location.pathname).toBe('/recipes')
		expect(updateCalls.deleted).toEqual(['recipe-1'])
	})

	test('moves the recipe into a book', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen
			.getByLabelText('book', { exact: true })
			.selectOptions('weeknight')

		await expect.poll(() => recipeState.recipe?.collectionId).toBe('col-1')
		await expect
			.element(screen.getByLabelText('book', { exact: true }))
			.toHaveDisplayValue('weeknight')
	})

	test('adds a shared recipe to the shelf without offering cook logging', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, {
			userId: null,
			saved: false,
			owned: false,
			savedAt: null,
		})

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect
			.element(screen.getByRole('button', { name: 'cooked it' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByLabelText('book', { exact: true }))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'save to shelf' }).click()
		await expect.poll(() => recipeState.recipe?.saved).toBe(true)
		expect(updateCalls.saved).toEqual(['recipe-1'])
		await screen.getByRole('button', { name: 'remove from shelf' }).click()
		await expect.poll(() => recipeState.recipe?.saved).toBe(false)
		expect(updateCalls.deleted).toEqual(['recipe-1'])
		await expect
			.element(screen.getByRole('button', { name: 'save to shelf' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: 'miso butter pasta' }))
			.toBeVisible()

		await expect
			.element(screen.getByRole('button', { name: 'cooked it' }))
			.not.toBeInTheDocument()
	})

	test('edits a shared recipe into your own copy', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, { userId: null, owned: false })
		recipeState.recipe.ingredients = ['200 g pasta']

		const { router, screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(
				screen.getByText('changing it makes your own copy', { exact: false }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'remove from shelf' }))
			.toBeVisible()
		await screen.getByLabelText('name').fill('my pasta')
		await expect
			.element(screen.getByText('editing your own copy now', { exact: false }))
			.toBeVisible()
		// Enter in the name submits, like done.
		await userEvent.keyboard('{Enter}')

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/recipes/recipe-copy')
		// The copy opens to read, not still in the editor.
		await expect
			.element(screen.getByRole('button', { name: 'edit' }))
			.toBeVisible()
		expect(updateCalls.calls[0]).toMatchObject({
			id: 'recipe-1',
			title: 'my pasta',
		})
	})
})
