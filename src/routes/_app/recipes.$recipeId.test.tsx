import { getAuthMocks, setMockSession } from '@tests/support/mocks/browser'
import { renderRoute } from '@tests/support/render/route'
import {
	expectIsolatedScreenshot,
	expectPageScreenshot,
} from '@tests/support/screenshot'
import { phoneOnly } from '@tests/support/viewport'
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

function fillRecipe() {
	if (!recipeState.recipe) throw new Error('recipe was not seeded')
	Object.assign(recipeState.recipe, {
		sourceUrl: 'https://example.com/pasta',
		servings: 4,
		totalMinutes: 25,
		ingredients: ['200g pasta', '2 tbsp miso', '3 tbsp butter', '1 lemon'],
		steps: [
			'Prep',
			'- Zest the lemon',
			'- Soften the butter',
			'Simmer the pasta until just done',
			'Stir in the miso and butter',
		],
	})
}

describe('recipe detail', () => {
	beforeEach(() => {
		updateCalls.calls.length = 0
		updateCalls.deleted.length = 0
		updateCalls.saved.length = 0
		sessionStorage.removeItem('after-sign-in')
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
			links: [],
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

	// Ingredients sit beside the steps on a wide page and above them on a phone.
	test('captures the recipe reader', async () => {
		fillRecipe()
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await expect
			.element(screen.getByRole('checkbox', { name: /Simmer/ }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'recipe-reader', {
			fullHeight: true,
		})
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
		await screen.getByRole('button', { name: 'edit original link' }).click()
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

	test('keeps more than one link, and lets an emptied one go', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.sourceUrl = 'https://example.com/pasta'
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'add another link' }).click()
		await screen.getByLabelText('link').fill('youtube.com/watch?v=pasta')
		await userEvent.keyboard('{Enter}')
		await expect
			.element(screen.getByRole('button', { name: 'edit link' }))
			.toHaveTextContent('youtube video')
		await expectIsolatedScreenshot(
			screen.getByRole('group', { name: 'about the recipe' }),
			'recipe-links',
		)

		// A link added and left empty is not kept.
		await screen.getByRole('button', { name: 'add another link' }).click()
		await expect.element(screen.getByLabelText('link')).toHaveFocus()
		await userEvent.keyboard('{Escape}')
		await expect.element(screen.getByLabelText('link')).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'edit link' }).elements(),
		).toHaveLength(1)

		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({
				sourceUrl: 'https://example.com/pasta',
				links: ['https://youtube.com/watch?v=pasta'],
			})
	})

	test('points a recipe to a youtube video, adding the scheme', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'add original link' }).click()
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
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
			.toHaveFocus()
		await userEvent.keyboard('2 tbsp butter')
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

	test('moves a line by its dots and removes one by backspacing', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta', '1 tbsp miso', '1 onion']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		screen
			.getByRole('button', { name: 'Move ingredient 2, 1 tbsp miso' })
			.element()
			.focus()
		await userEvent.keyboard('[Space]')
		await userEvent.keyboard('[ArrowUp]')
		await userEvent.keyboard('[Space]')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
			.toHaveValue('200 g pasta')

		// An emptied line backs out into the one above.
		await screen.getByRole('combobox', { name: 'Ingredient 3' }).fill('')
		await userEvent.keyboard('{Backspace}')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 2' }))
			.toHaveFocus()
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['1 tbsp miso', '200 g pasta'],
		})
	})

	test('keeps a section with lines from saving until it has a name', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta', '## sauce', '1 tbsp miso']

		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		const sectionName = screen.getByRole('textbox', { name: 'Section name 2' })
		await sectionName.fill('')
		await screen.getByRole('button', { name: 'save', exact: true }).click()

		// Nothing saves; the way is pointed to the section that needs a name.
		await expect.element(sectionName).toHaveFocus()
		await expect.element(sectionName).toHaveAttribute('aria-invalid', 'true')
		await expect
			.element(screen.getByText('give this section a name'))
			.toBeVisible()
		await expect
			.element(screen.getByText('name the section marked above to save'))
			.toBeVisible()
		expect(updateCalls.calls).toEqual([])
		await expectIsolatedScreenshot(
			screen.getByRole('group', { name: 'ingredients' }),
			'section-needs-name',
		)

		await sectionName.fill('for the sauce')
		await expect
			.element(screen.getByText('give this section a name'))
			.not.toBeInTheDocument()
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({
				ingredients: ['200 g pasta', '## for the sauce', '1 tbsp miso'],
			})
	})

	test('moves a whole section when it is taken by its name', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'## sauce',
			'1 tbsp miso',
			'2 tbsp butter',
			'## pasta',
			'200 g pasta',
		]

		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		screen
			.getByRole('button', { name: 'Move group 4, pasta' })
			.element()
			.focus()
		await userEvent.keyboard('[Space]')
		// Dropped on the card above, it goes where that card's name stands.
		await userEvent.keyboard('[ArrowUp]')
		await userEvent.keyboard('[Space]')
		await screen.getByRole('button', { name: 'save', exact: true }).click()

		await expect
			.poll(() => updateCalls.calls.at(-1))
			.toMatchObject({
				ingredients: [
					'## pasta',
					'200 g pasta',
					'## sauce',
					'1 tbsp miso',
					'2 tbsp butter',
				],
			})
	})

	test('leaves the lines unopened when a line is taken by its dots', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta', '1 tbsp miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('combobox', { name: 'Ingredient 1' }).click()
		await expect
			.element(screen.getByRole('toolbar', { name: 'amount' }))
			.toBeVisible()

		const handle = screen.getByRole('button', {
			name: 'Move ingredient 2, 1 tbsp miso',
		})

		await handle.click()

		// Neither the line being written nor the one taken opens for editing.
		await expect
			.element(screen.getByRole('toolbar', { name: 'amount' }))
			.not.toBeInTheDocument()
		expect(document.activeElement).not.toBe(handle.element())
	})

	test('starts a group from a line ending in a colon', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'200 g pasta',
			'1 tbsp miso',
			'2 tbsp butter',
		]

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('combobox', { name: 'Ingredient 1' }).click()
		await userEvent.keyboard('{End}{Enter}for the sauce:')
		await userEvent.keyboard('{Escape}{Enter}')
		await expect
			.element(screen.getByRole('textbox', { name: 'Section name 2' }))
			.toHaveValue('for the sauce')
		// The blank line it opened backs out into the name.
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 3' }))
			.toHaveFocus()
		await userEvent.keyboard('{Backspace}')
		await expect
			.element(screen.getByRole('textbox', { name: 'Section name 2' }))
			.toHaveFocus()
		screen.getByRole('textbox', { name: 'Section name 2' }).element().blur()
		await expectIsolatedScreenshot(
			screen.getByRole('group', { name: 'ingredients' }),
			'ingredient-sections',
		)
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: [
				'200 g pasta',
				'## for the sauce',
				'1 tbsp miso',
				'2 tbsp butter',
			],
		})
	})

	test('steps an amount and swaps its unit from the bar under the line', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['1 tbsp miso', '200 g pasta']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		const line = screen.getByRole('combobox', { name: 'Ingredient 1' })
		await line.click()
		const bar = screen.getByRole('toolbar', { name: 'amount' })
		await expect.element(bar).toBeVisible()
		await bar.getByRole('button', { name: 'more' }).click()
		await expect.element(line).toHaveValue('1 ½ tbsp miso')
		// The caret stays in the line, so typing carries on.
		await expect.element(line).toHaveFocus()
		await bar.getByRole('button', { name: 'tsp' }).click()
		await expect.element(line).toHaveValue('1 ½ tsp miso')
		await expectIsolatedScreenshot(
			screen.getByRole('list', { name: 'ingredient lines' }),
			'ingredient-amount-bar',
		)
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['1 ½ tsp miso', '200 g pasta'],
		})
	})

	test('offers a likely amount for a line written without one', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['garlic', 'salt to taste', '200 g pasta']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()

		const guess = screen.getByRole('button', {
			name: 'Use 3 cloves for garlic',
		})

		await expect.element(guess).toBeVisible()
		// A line that goes by feel is left as it is.
		await expect
			.element(screen.getByRole('button', { name: /for salt to taste/ }))
			.not.toBeInTheDocument()
		await expectIsolatedScreenshot(
			screen.getByRole('list', { name: 'ingredient lines' }),
			'ingredient-amount-guess',
		)
		await guess.click()
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('3 cloves garlic')
	})

	test('calls an unnamed card main ingredients until it is named', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'2 tsp cumin',
			'1 tbsp chili powder',
			'1 tsp oregano',
		]

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'Section name' }))
			.toHaveAttribute('placeholder', 'main ingredients')
		await expect
			.element(screen.getByRole('button', { name: 'Name it spice blend' }))
			.toBeVisible()
		await expectIsolatedScreenshot(
			screen.getByRole('list', { name: 'ingredient lines' }),
			'ingredient-unnamed-card',
		)
		await screen.getByRole('button', { name: 'Name it spice blend' }).click()
		await expect
			.element(screen.getByRole('textbox', { name: 'Section name 1' }))
			.toHaveValue('spice blend')
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)?.ingredients?.slice(0, 2)).toEqual([
			'## spice blend',
			'2 tsp cumin',
		])
	})

	test('shows a line as typed while it is edited', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = [
			'## sauce',
			'1 tbsp miso',
			'2 tbsp butter, softened',
			'salt to taste',
		]

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		const field = screen.getByRole('combobox', { name: 'Ingredient 3' })
		field.element().focus()
		await expect.element(field).toHaveFocus()
		await expectIsolatedScreenshot(
			screen.getByRole('group', { name: 'ingredients' }),
			'ingredient-editing',
		)
	})

	test('turns a group back into a line, and joins lines, with backspace', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['## sauce', '1 tbsp miso']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('textbox', { name: 'Section name 1' }).click()
		await userEvent.keyboard('{Home}{Backspace}')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('sauce')
		await screen.getByRole('combobox', { name: 'Ingredient 2' }).click()
		await userEvent.keyboard('{Home}{Backspace}')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toHaveValue('sauce 1 tbsp miso')
		await screen.getByRole('button', { name: 'save' }).click()

		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['sauce 1 tbsp miso'],
		})
	})

	phoneOnly('folds the ingredients and steps away on a phone', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['200 g pasta', '1 tbsp miso']
		recipeState.recipe.steps = ['boil the pasta']

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		await screen.getByRole('button', { name: 'edit' }).click()
		const ingredients = screen.getByRole('button', { name: 'ingredients' })
		await ingredients.click()

		// Folded, the list is a card saying what it holds.
		const folded = screen.getByRole('button', {
			name: 'ingredients, 2 ingredients',
		})

		await expect.element(folded).toHaveAttribute('aria-expanded', 'false')
		await expectIsolatedScreenshot(folded, 'ingredients-folded')
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.not.toBeInTheDocument()
		await folded.click()
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toBeVisible()
		await screen.getByRole('button', { name: 'steps' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'steps, 1 step' }))
			.toBeVisible()

		// Folded lists still save what they hold.
		await screen.getByLabelText('notes').fill('more miso')
		await screen.getByRole('button', { name: 'save' }).click()
		await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
		expect(updateCalls.calls.at(-1)).toMatchObject({
			ingredients: ['200 g pasta', '1 tbsp miso'],
			steps: ['boil the pasta'],
		})
	})

	describe('regrouping', () => {
		const tikka = {
			ingredients: [
				'1 lb chicken thighs',
				'1 cup plain yogurt',
				'1 tsp salt',
				'2 tbsp butter',
				'1 onion, diced',
				'fresh cilantro',
				'naan',
			],
			steps: [
				'Mix the yogurt and salt, and marinate the chicken in it.',
				'For the sauce, melt the butter and soften the onion.',
				'Serve with naan, scattered with cilantro.',
			],
		}

		beforeEach(() => {
			if (!recipeState.recipe) throw new Error('recipe was not seeded')
			Object.assign(recipeState.recipe, tikka)
		})

		test('shows a grouping from the steps in place, and keeps it', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/recipe-1',
				session,
			})

			await screen.getByRole('button', { name: 'edit' }).click()
			await screen.getByRole('button', { name: /^organize/ }).click()
			await expect
				.element(screen.getByText('3 sections from the steps'))
				.toBeVisible()
			await expect.element(screen.getByText('step 2')).toBeVisible()

			// Pointing at a group lights the step it goes into.
			await screen.getByText('for the sauce').hover()
			const step = screen.getByRole('textbox', { name: 'Step 2' }).element()
			await expect
				.poll(() => step.closest('li')?.className)
				.toMatch(/bg-kitchen-eggplant/)

			// The lines have settled into their groups.
			await Promise.all(
				document.getAnimations().map((animation) => animation.finished),
			)
			await expectIsolatedScreenshot(
				screen.getByRole('group', { name: 'ingredients' }),
				'ingredient-regroup',
			)
			await screen.getByRole('button', { name: 'keep' }).click()
			await expect
				.element(screen.getByRole('textbox', { name: 'Section name 5' }))
				.toHaveValue('for the sauce')
			await expect
				.element(
					screen.getByRole('button', {
						name: /^organize/,
					}),
				)
				.not.toBeInTheDocument()
			await screen.getByRole('button', { name: 'save' }).click()

			await expect.poll(() => updateCalls.calls.at(-1)).toBeDefined()
			expect(updateCalls.calls.at(-1)).toMatchObject({
				ingredients: [
					'## for the marinade',
					'1 lb chicken thighs',
					'1 cup plain yogurt',
					'1 tsp salt',
					'## for the sauce',
					'2 tbsp butter',
					'1 onion, diced',
					'## to serve',
					'fresh cilantro',
					'naan',
				],
			})
		})

		test('puts the list back as it was', async () => {
			const { screen } = await renderRoute({
				path: '/recipes/recipe-1',
				session,
			})

			await screen.getByRole('button', { name: 'edit' }).click()
			await screen.getByRole('button', { name: /^organize/ }).click()
			await screen.getByRole('button', { name: 'put it back' }).click()
			await expect
				.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
				.toHaveValue('1 lb chicken thighs')
			await expect
				.element(
					screen.getByRole('button', {
						name: /^organize/,
					}),
				)
				.toBeVisible()

			const pill = screen
				.getByRole('button', { name: 'not now' })
				.element().parentElement

			if (!pill) throw new Error('missing the organize offer')
			// The offer fades in; capture it settled.
			await Promise.all(
				document.getAnimations().map((animation) => animation.finished),
			)
			await expectIsolatedScreenshot(pill, 'ingredient-organize-offer')
			await screen.getByRole('button', { name: 'not now' }).click()
			await expect
				.element(
					screen.getByRole('button', {
						name: /^organize/,
					}),
				)
				.not.toBeInTheDocument()
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

	test('captures the recipe editor with its actions pinned', async () => {
		fillRecipe()
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByRole('button', { name: 'save', exact: true }))
			.toBeVisible()
		await expectPageScreenshot(screen.container, 'recipe-editor')
	})

	test('keeps an invalid source link in the editor until corrected', async () => {
		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })
		await screen.getByRole('button', { name: 'edit' }).click()
		await screen.getByRole('button', { name: 'add original link' }).click()
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
		await expect.element(screen.getByText('not saved yet: notes')).toBeVisible()
		await notes.fill('')
		await expect.element(save).toBeDisabled()
		await expect
			.element(screen.getByText('not saved yet: notes'))
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
		await screen.getByRole('button', { name: 'more' }).click()
		await page.getByRole('menuitem', { name: 'delete recipe' }).click()
		await expect

			.element(page.getByText('there is no undo', { exact: false }))
			.toBeVisible()
		await page.getByRole('button', { name: 'keep it' }).click()
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
		expect(updateCalls.deleted).toEqual([])

		await screen.getByRole('button', { name: 'more' }).click()
		await page.getByRole('menuitem', { name: 'delete recipe' }).click()
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
		// The saved state wears the eggplant accent.
		await expect
			.element(screen.getByRole('button', { name: 'saved', exact: true }))
			.toBeVisible()

		const bookmark = screen
			.getByRole('button', { name: 'saved', exact: true })
			.element()
			.querySelector('svg')

		if (!bookmark) throw new Error('saved button is missing its bookmark')
		expect(getComputedStyle(bookmark).color).toBe('rgb(91, 61, 245)')
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

	test('opens a published recipe to edit instead of sending it to its page', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		// Its readable page only reads, so editing stays at this address.
		Object.assign(recipeState.recipe, {
			userId: null,
			owned: false,
			publicPath: '/sites/example/miso',
		})

		const { screen, router } = await renderRoute({ path: '/recipes', session })

		await router.navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: 'recipe-1' },
			state: { editing: true },
		})
		await expect
			.element(screen.getByRole('combobox', { name: 'Ingredient 1' }))
			.toBeVisible()
		expect(router.state.location.pathname).toBe('/recipes/recipe-1')
	})

	test('keeps the way back to a search when a found recipe is published', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, {
			userId: null,
			owned: false,
			publicPath: '/sites/example/miso',
		})

		const { router } = await renderRoute({ path: '/recipes', session })

		await router.navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: 'recipe-1' },
			state: { foundBy: 'miso' },
		})
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/sites/example/miso')
		expect(router.state.location.state.foundBy).toBe('miso')
	})

	test('sends a published recipe back to its page when its edit is cancelled', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, {
			userId: null,
			owned: false,
			publicPath: '/sites/example/miso',
		})

		const { screen, router } = await renderRoute({ path: '/recipes', session })

		await router.navigate({
			to: '/recipes/$recipeId',
			params: { recipeId: 'recipe-1' },
			state: { editing: true },
		})
		await screen.getByRole('button', { name: 'cancel' }).click()
		// The edit request is spent, so a reload would not open the editor again.
		await expect
			.poll(() => router.state.location.pathname)
			.toBe('/sites/example/miso')
		expect(router.state.location.state.editing).toBeUndefined()
	})

	test('keeps the caret in place when the amount is edited from inside', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		recipeState.recipe.ingredients = ['2 tablespoons butter']

		const { screen } = await renderRoute({ path: '/recipes/recipe-1', session })

		await screen.getByRole('button', { name: 'edit' }).click()
		const line = screen.getByRole('combobox', { name: 'Ingredient 1' })
		await line.click()
		const field = line.element()

		if (!(field instanceof HTMLTextAreaElement)) throw new Error('not a field')
		field.setSelectionRange(1, 1)
		await userEvent.keyboard('0')

		await expect.element(line).toHaveValue('20 tbsp butter')
		expect(field.selectionStart).toBe(2)
	})

	test('copies a shared recipe only once a change is saved', async () => {
		if (!recipeState.recipe) throw new Error('recipe was not seeded')
		Object.assign(recipeState.recipe, {
			userId: null,
			owned: false,
			saved: true,
		})

		const { screen } = await renderRoute({
			path: '/recipes/recipe-1',
			session,
		})

		// Opening the editor copies nothing; cancelling leaves the shelf alone.
		await screen.getByRole('button', { name: 'edit' }).click()
		await expect
			.element(screen.getByText('in place of the saved one', { exact: false }))
			.toBeVisible()
		await screen.getByRole('button', { name: 'cancel' }).click()
		expect(updateCalls.calls).toEqual([])

		await screen.getByRole('button', { name: 'edit' }).click()
		await screen
			.getByRole('combobox', { name: 'Ingredient 1' })
			.fill('300 g pasta')
		await screen.getByRole('button', { name: 'save', exact: true }).click()
		await expect.poll(() => updateCalls.calls.at(-1)?.id).toBe('recipe-1')
	})

	describe('asked for before signing in', () => {
		beforeEach(() => {
			if (!recipeState.recipe) throw new Error('recipe was not seeded')
			Object.assign(recipeState.recipe, {
				userId: null,
				saved: false,
				owned: false,
				savedAt: null,
			})
		})

		async function signUpInDialog() {
			getAuthMocks().signUpEmail.mockImplementationOnce(async () => {
				setMockSession(session)

				return { error: null }
			})
			const dialog = page.getByRole('dialog', { name: 'create an account' })
			await dialog.getByLabelText('name').fill('Test User')
			await dialog.getByLabelText('email').fill('test@example.com')
			await dialog.getByLabelText('password').fill('password123')
			await dialog
				.getByRole('button', { name: 'create account', exact: true })
				.click()
		}

		test('saves once the dialog signs the visitor in', async () => {
			const { screen } = await renderRoute({ path: '/recipes/recipe-1' })

			await screen.getByRole('button', { name: 'save', exact: true }).click()
			expect(updateCalls.saved).toEqual([])
			await signUpInDialog()

			await expect.poll(() => updateCalls.saved).toEqual(['recipe-1'])
			await expect
				.element(screen.getByRole('button', { name: 'saved', exact: true }))
				.toBeVisible()
		})

		test('saves when the page loads again after google sign-in', async () => {
			const first = await renderRoute({ path: '/recipes/recipe-1' })

			await first.screen
				.getByRole('button', { name: 'save', exact: true })
				.click()
			await expect
				.element(page.getByRole('dialog', { name: 'create an account' }))
				.toBeVisible()
			// Google sign-in leaves the page and loads it again signed in.
			await first.screen.unmount()

			const next = await renderRoute({ path: '/recipes/recipe-1', session })

			await expect.poll(() => updateCalls.saved).toEqual(['recipe-1'])
			await expect
				.element(
					next.screen.getByRole('button', { name: 'saved', exact: true }),
				)
				.toBeVisible()
			expect(sessionStorage.getItem('after-sign-in')).toBeNull()
		})

		test('leaves a recipe alone when the account already has it', async () => {
			const first = await renderRoute({ path: '/recipes/recipe-1' })

			await first.screen
				.getByRole('button', { name: 'save', exact: true })
				.click()
			await first.screen.unmount()
			Object.assign(recipeState.recipe ?? {}, { saved: true })

			const next = await renderRoute({ path: '/recipes/recipe-1', session })

			await expect
				.element(
					next.screen.getByRole('button', { name: 'saved', exact: true }),
				)
				.toBeVisible()
			expect(updateCalls.saved).toEqual([])
			expect(sessionStorage.getItem('after-sign-in')).toBeNull()
		})

		test('opens the editor once the dialog signs the visitor in', async () => {
			const { screen } = await renderRoute({ path: '/recipes/recipe-1' })

			await screen.getByRole('button', { name: 'edit' }).click()
			await signUpInDialog()

			await expect
				.element(screen.getByRole('button', { name: 'cancel' }))
				.toBeVisible()
			// Only editing was asked for: nothing is saved or copied yet.
			expect(updateCalls.saved).toEqual([])
			expect(updateCalls.calls).toEqual([])
		})
	})
})
