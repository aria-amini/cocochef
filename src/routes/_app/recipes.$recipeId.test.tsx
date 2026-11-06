import { renderRoute } from '@tests/support/render/route'
import { phoneOnly } from '@tests/support/viewport'
import { toast } from 'sonner'
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { page, userEvent } from 'vitest/browser'

import type { getRecipe } from '@/lib/recipes/server'

type Recipe = NonNullable<Awaited<ReturnType<typeof getRecipe>>>

const recipeState: { recipe: Recipe | null } = vi.hoisted(() => ({
	recipe: null,
}))

type RecipeUpdate = Omit<
	Recipe,
	'userId' | 'imageUrl' | 'sourceUrl' | 'createdAt'
> & {
	imageUrl?: string | null | undefined
	sourceUrl?: string | null | undefined
	finalize?: boolean | undefined
}

const updateCalls = vi.hoisted(() => {
	const calls: RecipeUpdate[] = []
	const deleted: string[] = []
	const saved: string[] = []
	const exported: (string | undefined)[] = []

	return { calls, deleted, saved, exported }
})

vi.mock('@/lib/recipes/server', () => ({
	removeSavedRecipe: async ({ data }: { data: { id: string } }) => {
		updateCalls.deleted.push(data.id)

		if (recipeState.recipe)
			recipeState.recipe = { ...recipeState.recipe, saved: false }

		return { id: data.id }
	},
	copyRecipe: () => Promise.resolve(null),
	listShelf: () => Promise.resolve({ recipes: [] }),
	getRecipe: () => Promise.resolve(recipeState.recipe),
	updateRecipe: async ({ data }: { data: RecipeUpdate }) => {
		updateCalls.calls.push(data)

		if (recipeState.recipe) {
			const { finalize, imageUrl, sourceUrl, ...rest } = data

			Object.assign(recipeState.recipe, rest)

			if (sourceUrl !== undefined) recipeState.recipe.sourceUrl = sourceUrl

			if (imageUrl !== undefined) recipeState.recipe.imageUrl = imageUrl

			if (finalize) recipeState.recipe.finalizedAt = new Date()
		}

		return { id: data.id }
	},
	importRecipes: vi.fn(),
	exportRecipes: async ({ data }: { data: { id?: string } }) => {
		updateCalls.exported.push(data.id)

		return { recipes: [{ title: 'miso butter pasta' }] }
	},
	createRecipe: vi.fn(),
	saveRecipe: async ({ data }: { data: { id: string } }) => {
		updateCalls.saved.push(data.id)

		if (recipeState.recipe)
			recipeState.recipe = { ...recipeState.recipe, saved: true }

		return recipeState.recipe
	},
	deleteRecipe: async ({ data }: { data: { id: string } }) => {
		updateCalls.deleted.push(data.id)

		if (recipeState.recipe && !recipeState.recipe.owned)
			recipeState.recipe = {
				...recipeState.recipe,
				saved: false,
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
		updateCalls.calls.length = 0
		updateCalls.deleted.length = 0
		updateCalls.saved.length = 0
		updateCalls.exported.length = 0
		recipeState.recipe = {
			id: 'recipe-1',
			visibility: null,
			authorName: null,
			originalAuthorName: null,
			userId: 'user-1',
			title: 'miso butter pasta',
			imageUrl: null,
			sourceUrl: null,
			sourceNotes: null,
			servings: null,
			totalMinutes: null,
			notes: null,
			createdAt: new Date(),
			finalizedAt: new Date(),
			cookCount: 0,
			lastCookedAt: null,
			forkedFromId: null,
			publicPath: null,
			savedAt: new Date(),
			saved: true,
			owned: true,
			ingredients: [],
			ingredientCategories: {},
			steps: [],
		}
	})

	test('shows private status on an owned recipe image', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByText('saved recipe', { exact: true }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByText('private recipe', { exact: true }))
			.toBeInTheDocument()
	})

	phoneOnly(
		'keeps the tab bar on a phone and returns to the recipe from another tab',
		async () => {
			const { screen, router } = await renderRoute({
				path: '/recipes/recipe-1',
				session,
			})

			const nav = screen.getByRole('navigation', { name: 'Primary' })

			await expect
				.element(nav.getByRole('link', { name: 'recipes' }))
				.toHaveAttribute('aria-current', 'page')
			await expect
				.element(
					screen
						.getByRole('main')
						.getByRole('link', { name: 'back to recipes' }),
				)
				.toBeVisible()

			await nav.getByRole('link', { name: 'groceries' }).click()
			await expect
				.element(
					screen.getByRole('heading', { name: 'groceries', exact: true }),
				)
				.toBeVisible()

			await nav.getByRole('link', { name: 'recipes' }).click()
			await vi.waitFor(() =>
				expect(router.state.location.pathname).toBe('/recipes/recipe-1'),
			)

			// From the recipe itself, the tab goes up to the shelf.
			await nav.getByRole('link', { name: 'recipes' }).click()
			await vi.waitFor(() =>
				expect(router.state.location.pathname).toBe('/recipes'),
			)
		},
	)

	test('renders content and separate empty states', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200g pasta', '1 tbsp miso']
		recipeState.recipe.steps = ['boil the pasta', 'stir in the miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect
			.element(screen.getByRole('checkbox', { name: '200g pasta' }))
			.toBeVisible()
		await expect.element(screen.getByText('boil the pasta')).toBeVisible()
	})

	test('fills the page beside the sidebar even when the recipe is short', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['Salt']
		recipeState.recipe.steps = []
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByRole('checkbox', { name: 'Salt' }))
			.toBeVisible()

		const main = document.querySelector('main')

		if (!main) throw new Error('main missing')
		expect(
			Math.abs(main.getBoundingClientRect().right - window.innerWidth),
		).toBeLessThan(1)
	})

	test('nests sub-steps under their step, without a box for the step itself', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['1 onion']
		recipeState.recipe.steps = [
			'Prep',
			'- Chop the onion',
			'- Wash the pot',
			'Simmer',
		]
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await expect
			.element(
				screen.getByRole('checkbox', { name: 'step 1.1: Chop the onion' }),
			)
			.toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: 'step 1.2: Wash the pot' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: 'step 2: Simmer' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: 'step 1: Prep' }))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByText('Prep', { exact: true }))
			.toBeVisible()
	})

	test('puts ingredients beside the steps on a wide page and stacks them on a narrow one', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['2 large eggs', '1 carrot']
		recipeState.recipe.steps = ['whisk the eggs', 'fold in the carrot']
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByRole('checkbox', { name: 'step 1: whisk the eggs' }))
			.toBeVisible()

		const ingredients = document.querySelector(
			'table[aria-label="ingredients"]',
		)

		const steps = document.querySelector('ol')

		if (!ingredients || !steps) throw new Error('lists missing')
		const left = ingredients.getBoundingClientRect()
		const right = steps.getBoundingClientRect()

		// The sidebar takes room from the page, so "wide" is what the page gets.
		if (window.innerWidth >= 1024) {
			expect(right.left).toBeGreaterThanOrEqual(left.right)
			expect(Math.abs(right.top - left.top)).toBeLessThan(80)
		} else {
			expect(right.top).toBeGreaterThanOrEqual(left.bottom)
		}
	})

	test('shows specific and family icons while leaving unknown ingredients empty', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'2 apples',
			'1 lime',
			'1 egg',
			'chopped parsley',
			'200g pork',
			'1 cup chicken broth',
			'mystery ingredient',
		]
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		const rowFor = (name: string) =>
			screen.getByRole('checkbox', { name }).element().closest('tr')

		expect(rowFor('2 apples')?.querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/pantry/apple.png',
		)
		expect(rowFor('1 egg')?.querySelector('img')?.getAttribute('src')).toBe(
			'/sprites/pantry/egg.png',
		)

		for (const [name, key] of [
			['1 lime', 'lime'],
			['200g pork', 'meat'],
		] as const) {
			expect(rowFor(name)?.querySelector('img')?.getAttribute('src')).toBe(
				`/sprites/pantry/${key}.png`,
			)
		}

		// A recolourable sprite is its shading over a fill painted in the food's colour.
		for (const [name, key, tint] of [
			['chopped parsley', 'herb-bunch', '#3E8A3F'],
			['1 cup chicken broth', 'carton', '#E8C86A'],
		] as const) {
			const row = rowFor(name)

			expect(row?.querySelector('img')?.getAttribute('src')).toBe(
				`/sprites/pantry/tint/${key}.png`,
			)
			expect(
				row
					?.querySelector<HTMLElement>('span[style*="--tint"]')
					?.style.getPropertyValue('--tint')
					.trim(),
			).toBe(tint)
		}

		expect(rowFor('mystery ingredient')?.querySelector('img')).toBeNull()
		expect(
			Array.from(
				document.querySelectorAll('table[aria-label="ingredients"] input'),
			).map((item) => item.getAttribute('aria-label')),
		).toEqual(recipeState.recipe.ingredients)
	})

	test('keeps existing ingredient categories through an edit', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['2 large eggs']
		recipeState.recipe.ingredientCategories = { '2 large eggs': 'other' }
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('notes').fill('whisk well')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({
				ingredients: ['2 large eggs'],
				ingredientCategories: { '2 large eggs': 'other' },
			})
	})

	test('keeps a published recipe at its readable address', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.publicPath = '/aria-amini/miso-butter-pasta'
		const { router } = await renderRoute({ path: '/recipes/recipe-1', session })

		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/aria-amini/miso-butter-pasta')
	})

	test('shows the page a recipe came from', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, {
			sourceUrl: 'https://example.com/pasta',
			forkedFromId: 'shared-1',
		})
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await expect
			.element(screen.getByRole('link', { name: 'from example.com' }))
			.toHaveAttribute('href', 'https://example.com/pasta')
	})

	test('calls a youtube link a video to watch', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceUrl = 'https://www.youtube.com/watch?v=abc'
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await expect
			.element(screen.getByRole('link', { name: 'watch on youtube' }))
			.toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc')
	})

	test('removing the link in the editor takes it off the recipe', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceUrl = 'https://example.com/pasta'
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByLabelText('original link'))
			.toHaveValue('https://example.com/pasta')
		await screen.getByLabelText('original link').fill('')
		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({ sourceUrl: null })
		await expect
			.element(screen.getByText('from example.com'))
			.not.toBeInTheDocument()
	})

	test('points a recipe to a youtube video, adding the scheme', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('original link').fill('youtube.com/watch?v=abc')
		await expect
			.element(screen.getByText('a video to cook along with.'))
			.toBeVisible()
		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({ sourceUrl: 'https://youtube.com/watch?v=abc' })
		await expect
			.element(screen.getByRole('link', { name: 'watch on youtube' }))
			.toBeVisible()
	})

	test('exports one recipe as a file from the share dialog', async () => {
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => undefined)

		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'share' }).click()
		await screen.getByRole('button', { name: 'export as file' }).click()
		await expect.poll(() => click.mock.calls.length).toBe(1)
		expect(updateCalls.exported).toEqual(['recipe-1'])
	})

	test('shows placeholders when content is empty', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect.element(screen.getByText('no ingredients yet')).toBeVisible()
		await expect.element(screen.getByText('no steps yet')).toBeVisible()
	})

	test('keeps ingredient text together in recipe order', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'200g pasta',
			'2 large eggs (, at room temperature)',
			'12oz / 340g fresh spinach',
			'500g beef mince ((ground beef), any fat % you like)',
		]
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		const row = screen
			.getByRole('checkbox', { name: '2 large eggs (, at room temperature)' })
			.element()
			.closest('tr')

		expect(row?.textContent).toBe('2 large eggs (at room temperature)')
		expect(
			screen
				.getByRole('checkbox', {
					name: '500g beef mince ((ground beef), any fat % you like)',
				})
				.element()
				.closest('tr')?.textContent,
		).toBe('500g beef mince (ground beef, any fat % you like)')
		expect(
			screen
				.getByRole('checkbox', { name: '12oz / 340g fresh spinach' })
				.element()
				.closest('tr')?.textContent,
		).toBe('12oz / 340g fresh spinach')
		await expect
			.element(screen.getByText('dairy & eggs', { exact: true }))
			.not.toBeInTheDocument()
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			window.innerWidth,
		)
	})

	test('does not treat a source heading as an ingredient', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['## for the sauce', '1 tbsp miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await expect.element(screen.getByText('for the sauce')).toBeVisible()
		await expect
			.element(screen.getByText('## for the sauce'))
			.not.toBeInTheDocument()
		await expect
			.element(screen.getByRole('checkbox', { name: '1 tbsp miso' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('checkbox', { name: /for the sauce/ }))
			.not.toBeInTheDocument()
	})

	test('shows publisher and personal notes separately', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceNotes = 'Use a heavy pan.'
		recipeState.recipe.notes = 'Add more lemon.'
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByRole('heading', { name: 'recipe notes' }))
			.toBeVisible()
		await expect.element(screen.getByText('Use a heavy pan.')).toBeVisible()
		await expect.element(screen.getByText('Add more lemon.')).toBeVisible()
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
		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.element(screen.getByRole('checkbox', { name: '2 tbsp butter' }))
			.toBeVisible()
		await expect.element(screen.getByText('stir in the butter')).toBeVisible()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['200 g pasta', '2 tbsp butter'],
			steps: ['boil the pasta', 'stir in the butter'],
		})
		expect(updateCalls.calls.at(-1)?.finalize).toBe(false)
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
		await screen.getByRole('button', { name: 'save' }).click()

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
		await screen.getByRole('button', { name: 'save' }).click()
		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)?.imageUrl).toBeUndefined()

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'Remove photo' }).click()
		await expect
			.element(screen.getByLabelText('Recipe photo'))
			.toBeInTheDocument()
		await screen.getByRole('button', { name: 'save' }).click()
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
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)?.imageUrl).toBe('recipes/user-1-photo')
	})

	test('keeps the source field beside the name and the actions sticky', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		const name = screen.getByRole('textbox', { name: 'name' }).element()

		const source = screen
			.getByRole('textbox', { name: 'original link' })
			.element()

		expect(name.parentElement).toBe(source.parentElement?.parentElement)

		const save = screen
			.getByRole('button', { name: 'save', exact: true })
			.element()

		expect(
			save.parentElement && getComputedStyle(save.parentElement).position,
		).toBe('sticky')
	})

	test('keeps an invalid source link in the editor until corrected', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		const source = screen.getByRole('textbox', { name: 'original link' })
		await source.fill('not a url')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.element(source).toHaveFocus()
		await expect
			.element(screen.getByText(/look like a web address yet/))
			.toBeVisible()
		expect(updateCalls.calls).toHaveLength(0)
		await source.fill('example.com/recipe')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({ sourceUrl: 'https://example.com/recipe' })
	})

	test('enables save only for changes and summarizes them', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		const save = screen.getByRole('button', { name: 'save', exact: true })
		await expect.element(save).toBeDisabled()
		const notes = screen.getByLabelText('notes')
		await notes.fill('more lemon')
		await expect.element(save).toBeEnabled()
		await expect.element(screen.getByText('changed: notes')).toBeVisible()
		await notes.fill('')
		await expect.element(save).toBeDisabled()
		await expect
			.element(screen.getByText('changed: notes'))
			.not.toBeInTheDocument()
	})

	test('saves edits only when save is pressed', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('notes').fill('more lemon')
		expect(updateCalls.calls).toHaveLength(0)
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({ notes: 'more lemon' })
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

		await screen.getByRole('button', { name: 'save' }).click()

		await expect
			.element(screen.getByRole('checkbox', { name: '⅓ cup flour' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'edit' }))
			.toBeVisible()
		expect(updateCalls.calls.at(-1)?.finalize).toBe(true)
	})

	test('checks ingredients and steps temporarily and resets after leaving', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['1 carrot']
		recipeState.recipe.steps = ['Chop carrot']

		const { screen, router } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		const ingredient = screen.getByRole('checkbox', { name: '1 carrot' })
		const step = screen.getByRole('checkbox', { name: /Chop carrot/ })
		await ingredient.click()
		await step.click()
		await expect.element(ingredient).toBeChecked()
		await expect.element(step).toBeChecked()
		await router.navigate({
			to: '/coming-soon/$feature',
			params: { feature: 'groceries' },
		})
		await router.navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: 'recipe-1' },
		})
		await expect
			.element(screen.getByRole('checkbox', { name: '1 carrot' }))
			.not.toBeChecked()
		await expect
			.element(screen.getByRole('checkbox', { name: /Chop carrot/ }))
			.not.toBeChecked()
	})

	test('edits the name and notes', async () => {
		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByLabelText('name').fill('brown butter pasta')
		await screen.getByLabelText('notes').fill('more lemon')
		await screen.getByRole('button', { name: 'save' }).click()

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
		await expect

			.element(page.getByText('there is no undo', { exact: false }))
			.toBeVisible()
		await page.getByRole('button', { name: 'keep it' }).click()
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
		expect(updateCalls.deleted).toEqual([])

		await screen.getByRole('button', { name: 'delete', exact: true }).click()
		await page.getByRole('button', { name: 'delete', exact: true }).click()

		await expect.poll(() => router.state.location.pathname).toBe('/recipes')
		expect(updateCalls.deleted).toEqual(['recipe-1'])
		// The recipes tab must not lead back to a deleted recipe.
		expect(sessionStorage.getItem('cocochef:last-recipe')).toBeNull()
	})

	test('adds a shared recipe to the shelf and takes it back off', async () => {
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

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(() => recipeState.recipe?.saved).toBe(true)
		expect(updateCalls.saved).toEqual(['recipe-1'])
		// A saved recipe's bookmark asks before taking it back off the shelf.
		await screen.getByRole('button', { name: 'saved', exact: true }).click()
		await page.getByRole('button', { name: 'keep it' }).click()
		expect(updateCalls.deleted).toEqual([])
		await screen.getByRole('button', { name: 'saved', exact: true }).click()
		await expect

			.element(page.getByText('it comes off your shelf', { exact: false }))
			.toBeVisible()
		await page.getByRole('button', { name: 'remove', exact: true }).click()
		await expect.poll(() => recipeState.recipe?.saved).toBe(false)
		expect(updateCalls.deleted).toEqual(['recipe-1'])
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('heading', { name: 'miso butter pasta' }))
			.toBeVisible()
	})

	test('offers a copy action for shared recipes without offering edit', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, { userId: null, owned: false })
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await expect
			.element(screen.getByRole('button', { name: 'make copy' }))
			.toBeVisible()
		await expect
			.element(screen.getByRole('button', { name: 'edit' }))
			.not.toBeInTheDocument()
	})
})
