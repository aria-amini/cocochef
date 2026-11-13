import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { mealLogs, recipes, user } from '@/db/schema'
import {
	getOwnedRecipeAtAddress,
	getRecipeShare,
	saveSharingProfile,
	setRecipeShare,
} from '@/lib/sharing/repository'

import { recipeUpdateInput } from './model'
import {
	addMissingSourceNotes,
	copyRecipeForUser,
	createRecipeForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listShelfForUser,
	removeSavedRecipeForUser,
	popularSharedRecipes,
	saveRecipeForUser,
	shelfRecipeUsing,
	createSharedRecipe,
	findSharedRecipeByUrl,
	findLovedRecipesForUser,
	findRecipesForUser,
	sharedRecipeUrls,
	updateRecipeForUser,
} from './repository'

async function seedUser(db: Database) {
	const id = crypto.randomUUID()
	await db.insert(user).values({
		id,
		name: 'Test User',
		email: `${id}@example.com`,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return id
}

describe('recipe shelf', () => {
	test('copies a public recipe into a private independent shelf entry', async ({
		db,
	}) => {
		const writer = await seedUser(db)
		const reader = await seedUser(db)
		await saveSharingProfile(
			writer,
			{ handle: 'writer', displayName: 'Writer', autoPublish: false },
			db,
		)
		await saveSharingProfile(
			reader,
			{ handle: 'reader', displayName: 'Reader', autoPublish: false },
			db,
		)

		const original = await createRecipeForUser(
			writer,
			{ title: 'lentil soup', ingredients: ['lentils'], steps: ['simmer'] },
			db,
		)

		if (!original) throw new Error('missing original')
		await setRecipeShare(
			writer,
			{ recipeId: original.id, visibility: 'public' },
			db,
		)
		const copy = await copyRecipeForUser(reader, original.id, db)

		if (!copy) throw new Error('copy failed')
		expect(copy.path).toBe('/reader/lentil-soup')
		expect(copy.forkedFromId).toBe(original.id)
		expect(await getRecipeForUser(reader, copy.id, db)).toMatchObject({
			owned: true,
			saved: true,
			ingredients: ['lentils'],
			steps: ['simmer'],
		})
		expect(await getRecipeShare(reader, copy.id, db)).toMatchObject({
			visibility: 'private',
		})
		expect(await getRecipeForUser(writer, copy.id, db)).toBeNull()
		expect(await getRecipeForUser(writer, original.id, db)).toMatchObject({
			title: 'lentil soup',
		})
	})

	test('gives a first copy a private profile address automatically', async ({
		db,
	}) => {
		const cook = await seedUser(db)
		const other = await seedUser(db)

		const source = await createSharedRecipe(
			{
				title: 'tomato soup',
				sourceUrl: 'https://example.com/soup',
				ingredients: ['tomato'],
			},
			db,
		)

		if (!source) throw new Error('missing source')
		const copy = await copyRecipeForUser(cook, source.id, db)

		if (!copy) throw new Error('missing copy')
		const [, handle, slug] = copy.path.split('/')

		if (!handle || !slug) throw new Error('missing address')
		expect(handle).toBe('test-user')
		expect(slug).toBe('tomato-soup')
		expect(await getOwnedRecipeAtAddress(cook, handle, slug, db)).toEqual({
			id: copy.id,
		})
		expect(await getOwnedRecipeAtAddress(other, handle, slug, db)).toBeNull()
		const otherCopy = await copyRecipeForUser(other, source.id, db)

		if (!otherCopy) throw new Error('missing second copy')
		expect(otherCopy.path).toMatch(/^\/test-user-[a-f0-9]{8}\/tomato-soup$/)
	})

	test('unsave cannot delete a recipe owned by the caller', async ({ db }) => {
		const owner = await seedUser(db)
		const recipe = await createRecipeForUser(owner, { title: 'soup' }, db)

		if (!recipe) throw new Error('missing recipe')
		expect(await removeSavedRecipeForUser(owner, recipe.id, db)).toBeNull()
		await expect(getRecipeForUser(owner, recipe.id, db)).resolves.toMatchObject(
			{ saved: true, owned: true },
		)
	})

	test('shelves a new recipe', async ({ db }) => {
		const userId = await seedUser(db)
		const recipe = await createRecipeForUser(userId, { title: 'dal' }, db)

		if (!recipe) throw new Error('recipe was not created')
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ saved: true })
		expect((await listShelfForUser(userId, db)).recipes).toHaveLength(1)
	})

	test('scopes the shelf to the user', async ({ db }) => {
		const userId = await seedUser(db)
		await createRecipeForUser(userId, { title: 'dal' }, db)

		const other = await listShelfForUser('user-2', db)
		expect(other.recipes).toHaveLength(0)
		expect(await getRecipeForUser('user-2', 'missing', db)).toBeNull()
	})

	test('creates and reads recipe content in order', async ({ db }) => {
		const userId = await seedUser(db)

		const recipe = await createRecipeForUser(
			userId,
			{
				title: 'dal',
				ingredients: [' lentils ', '', 'salt'],
				steps: [' simmer ', 'serve'],
			},
			db,
		)

		if (!recipe) throw new Error('recipe was not created')

		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({
			ingredients: ['lentils', 'salt'],
			steps: ['simmer', 'serve'],
		})
	})

	test('keeps the groups a cook picks, only for lines that are still there', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const recipe = await createRecipeForUser(
			userId,
			{
				title: 'omelette',
				ingredients: ['2 large eggs', '1 onion'],
				ingredientCategories: { '2 large eggs': 'meat', 'gone line': 'spices' },
			},
			db,
		)

		if (!recipe) throw new Error('recipe was not created')
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({
			ingredientCategories: { '2 large eggs': 'meat' },
		})

		const update = recipeUpdateInput.parse({
			id: recipe.id,
			title: 'omelette',
			notes: null,
			ingredients: ['2 large eggs', '1 onion'],
			ingredientCategories: { '1 onion': 'other' },
			steps: [],
		})

		await updateRecipeForUser(userId, update, db)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ ingredientCategories: { '1 onion': 'other' } })

		await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({ ...update, ingredientCategories: {} }),
			db,
		)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ ingredientCategories: {} })
		expect(
			recipeUpdateInput.safeParse({
				...update,
				ingredientCategories: { '1 onion': 'furniture' },
			}).success,
		).toBe(false)
	})

	test('updates recipe details and content and checks ownership', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const recipe = await createRecipeForUser(
			userId,
			{ title: 'dal', ingredients: ['lentils'], steps: ['simmer'] },
			db,
		)

		if (!recipe) throw new Error('recipe was not created')

		const update = recipeUpdateInput.parse({
			id: recipe.id,
			title: 'tomato dal',
			notes: '  ',
			ingredients: ['tomatoes'],
			steps: ['toast', '', 'serve'],
		})

		await updateRecipeForUser(userId, update, db)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({
			title: 'tomato dal',
			notes: null,
			ingredients: ['tomatoes'],
			steps: ['toast', 'serve'],
		})
		await expect(
			updateRecipeForUser(
				'user-2',
				{ ...update, title: 'stolen', ingredients: [], steps: [] },
				db,
			),
		).resolves.toBeNull()
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({
			title: 'tomato dal',
			ingredients: ['tomatoes'],
			steps: ['toast', 'serve'],
		})
	})

	test("deletes only the owner's recipe", async ({ db }) => {
		const userId = await seedUser(db)

		const recipe = await createRecipeForUser(
			userId,
			{ title: 'dal', ingredients: ['lentils'] },
			db,
		)

		if (!recipe) throw new Error('recipe was not created')

		await expect(
			deleteRecipeForUser('user-2', recipe.id, db),
		).resolves.toBeNull()
		await expect(deleteRecipeForUser(userId, recipe.id, db)).resolves.toEqual({
			id: recipe.id,
		})
		await expect(getRecipeForUser(userId, recipe.id, db)).resolves.toBeNull()
	})

	test('finalizes new recipes unless they are drafts, and finalizes on update', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const made = await createRecipeForUser(userId, { title: 'dal' }, db)

		const draft = await createRecipeForUser(
			userId,
			{ title: 'stew', finalized: false },
			db,
		)

		expect(made?.finalizedAt).toBeInstanceOf(Date)
		expect(draft?.finalizedAt).toBeNull()

		if (!draft) throw new Error('draft was not created')

		const saved = await updateRecipeForUser(
			userId,
			{
				id: draft.id,
				title: 'stew',
				notes: null,
				ingredients: [],
				steps: [],
			},
			db,
		)

		expect(saved?.finalizedAt).toBeNull()

		const finalized = await updateRecipeForUser(
			userId,
			{
				id: draft.id,
				title: 'stew',
				notes: null,
				ingredients: [],
				steps: [],
				finalize: true,
			},
			db,
		)

		expect(finalized?.finalizedAt).toBeInstanceOf(Date)
	})

	test('says how far each draft on the shelf has got', async ({ db }) => {
		const userId = await seedUser(db)
		await createRecipeForUser(userId, { title: 'dal' }, db)

		const draft = await createRecipeForUser(
			userId,
			{ title: 'stew', finalized: false },
			db,
		)

		if (!draft) throw new Error('draft was not created')
		await updateRecipeForUser(
			userId,
			{
				id: draft.id,
				title: 'stew',
				notes: null,
				ingredients: ['## base', '1 onion', '2 carrots'],
				steps: ['soften the onion'],
			},
			db,
		)

		const { recipes } = await listShelfForUser(userId, db)

		expect(recipes.find((recipe) => recipe.id === draft.id)?.written).toEqual({
			ingredients: 2,
			steps: 1,
		})
		expect(recipes.find((recipe) => recipe.title === 'dal')).not.toHaveProperty(
			'written',
		)
	})

	test('keeps uploaded photos to their owner', async ({ db }) => {
		const userId = await seedUser(db)

		await expect(
			createRecipeForUser(
				userId,
				{ title: 'dal', imageUrl: 'recipes/other-1' },
				db,
			),
		).rejects.toThrow('Invalid recipe photo')

		const recipe = await createRecipeForUser(
			userId,
			{ title: 'dal', imageUrl: `recipes/${userId}-abc` },
			db,
		)

		expect(recipe?.imageUrl).toBe(`recipes/${userId}-abc`)
	})

	test('keeps, replaces, and clears the photo on update', async ({ db }) => {
		const userId = await seedUser(db)

		const recipe = await createRecipeForUser(
			userId,
			{ title: 'dal', imageUrl: 'https://example.com/dal.jpg' },
			db,
		)

		if (!recipe) throw new Error('recipe was not created')

		const edit = {
			id: recipe.id,
			title: 'dal',
			notes: null,
			ingredients: [],
			steps: [],
		}

		await updateRecipeForUser(userId, recipeUpdateInput.parse(edit), db)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ imageUrl: 'https://example.com/dal.jpg' })

		await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({ ...edit, imageUrl: `recipes/${userId}-new` }),
			db,
		)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ imageUrl: `recipes/${userId}-new` })

		await expect(
			updateRecipeForUser(
				userId,
				recipeUpdateInput.parse({ ...edit, imageUrl: 'recipes/other-1' }),
				db,
			),
		).rejects.toThrow('Invalid recipe photo')

		await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({ ...edit, imageUrl: null }),
			db,
		)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ imageUrl: null })
	})
})

describe('shared recipes', () => {
	async function seedShared(db: Database, url = 'https://example.com/dal') {
		const recipe = await createSharedRecipe(
			{
				title: 'shared dal',
				sourceUrl: url,
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			},
			db,
		)

		if (!recipe) throw new Error('shared recipe was not created')

		return recipe
	}

	test('keeps publisher notes separate from private notes and copies them on edit', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const shared = await seedShared(db)
		await addMissingSourceNotes(shared.id, 'Source tip', db)
		await addMissingSourceNotes(shared.id, 'Replacement', db)
		await saveRecipeForUser(userId, shared.id, db)

		const copy = await updateRecipeForUser(
			userId,
			{
				id: shared.id,
				title: 'my dal',
				imageUrl: null,
				notes: 'My private note',
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			},
			db,
		)

		if (!copy) throw new Error('copy was not created')
		expect(copy.id).not.toBe(shared.id)
		expect(await getRecipeForUser(userId, copy.id, db)).toMatchObject({
			sourceNotes: 'Source tip',
			notes: 'My private note',
		})
	})

	test('keeps more links than the original, and copies them on edit', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const shared = await seedShared(db)
		await saveRecipeForUser(userId, shared.id, db)

		const edit = {
			id: shared.id,
			title: 'shared dal',
			imageUrl: null,
			notes: null,
			ingredients: ['lentils', 'salt'],
			steps: ['simmer'],
		}

		// Adding a link is a change, so the cook gets their own copy.
		const copy = await updateRecipeForUser(
			userId,
			{ ...edit, links: ['https://youtu.be/dal'] },
			db,
		)

		if (!copy) throw new Error('copy was not created')
		expect(copy.id).not.toBe(shared.id)
		expect(await getRecipeForUser(userId, copy.id, db)).toMatchObject({
			sourceUrl: 'https://example.com/dal',
			links: ['https://youtu.be/dal'],
		})

		// Their copy keeps its links through an edit that leaves them out, and
		// drops them when they are emptied.
		await updateRecipeForUser(userId, { ...edit, id: copy.id }, db)
		expect(await getRecipeForUser(userId, copy.id, db)).toMatchObject({
			links: ['https://youtu.be/dal'],
		})
		await updateRecipeForUser(userId, { ...edit, id: copy.id, links: [] }, db)
		expect(await getRecipeForUser(userId, copy.id, db)).toMatchObject({
			links: [],
		})
	})

	test('stores one recipe per page, for everyone', async ({ db }) => {
		const first = await seedShared(db)
		const again = await seedShared(db)
		expect(again.id).toBe(first.id)
		expect(first.userId).toBeNull()
		await expect(
			findSharedRecipeByUrl('https://example.com/dal', db),
		).resolves.toMatchObject({ id: first.id })
		await expect(
			sharedRecipeUrls(
				['https://example.com/dal', 'https://example.com/x'],
				db,
			),
		).resolves.toEqual(['https://example.com/dal'])
		await expect(sharedRecipeUrls([], db)).resolves.toEqual([])
	})

	test('ranks popular recipes by saves and recent cooks, minus your own shelf', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const thirdId = await seedUser(db)
		const quiet = await seedShared(db, 'https://example.com/quiet')
		const saved = await seedShared(db, 'https://example.com/saved')
		const cooked = await seedShared(db, 'https://example.com/cooked')
		const mine = await seedShared(db, 'https://example.com/mine')

		await saveRecipeForUser(otherId, saved.id, db)
		await saveRecipeForUser(thirdId, saved.id, db)
		await saveRecipeForUser(userId, mine.id, db)
		await saveRecipeForUser(otherId, mine.id, db)
		await saveRecipeForUser(thirdId, mine.id, db)
		await db.insert(mealLogs).values(
			[1, 2, 3].map(() => ({
				id: crypto.randomUUID(),
				userId: otherId,
				recipeId: cooked.id,
				cookedAt: new Date(),
			})),
		)
		// A cook from long ago no longer counts.
		await db.insert(mealLogs).values({
			id: crypto.randomUUID(),
			userId: otherId,
			recipeId: quiet.id,
			cookedAt: new Date('2020-01-01'),
		})

		const seeded = new Set([quiet.id, saved.id, cooked.id, mine.id])

		// Other tests share the database; only these recipes are compared.
		const popular = (await popularSharedRecipes(userId, 100, db)).filter(
			(recipe) => seeded.has(recipe.id),
		)

		expect(popular.map((recipe) => recipe.id)).toEqual([
			cooked.id,
			saved.id,
			quiet.id,
		])
		await expect(popularSharedRecipes(userId, 1, db)).resolves.toHaveLength(1)
	})

	test('finds recipes by name or ingredient, with every word', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const tag = crypto.randomUUID().slice(0, 8)

		const shared = await createSharedRecipe(
			{
				title: `${tag} traybake`,
				sourceUrl: `https://example.com/${tag}`,
				ingredients: ['6 chicken thighs', '1 lemon'],
				steps: ['roast'],
			},
			db,
		)

		const mine = await createRecipeForUser(
			userId,
			{ title: `lemon chicken ${tag}`, ingredients: ['chicken'] },
			db,
		)

		await createRecipeForUser(
			otherId,
			{ title: `secret lemon chicken ${tag}`, ingredients: ['lemon'] },
			db,
		)

		if (!shared || !mine) throw new Error('recipes were not created')

		const found = await findRecipesForUser(
			userId,
			`${tag} lemon chicken`,
			20,
			db,
		)

		// Both hold every word; the one named with more of them ranks first.
		// Someone else's own recipe never shows.
		expect(found.map((recipe) => recipe.id)).toEqual([mine.id, shared.id])
		expect(found[0]).toMatchObject({
			saved: true,
			owned: true,
			ingredientMatches: [],
		})
		expect(found[1]).toMatchObject({
			saved: false,
			owned: false,
			ingredientMatches: ['lemon', 'chicken'],
		})

		await expect(
			findRecipesForUser(userId, `${tag} thighs`, 20, db),
		).resolves.toEqual([expect.objectContaining({ id: shared.id })])
		await expect(
			findRecipesForUser(userId, `${tag} mango`, 20, db),
		).resolves.toEqual([])
		await expect(findRecipesForUser(userId, '% _', 20, db)).resolves.toEqual([])
	})

	test('orders every rated recipe by its stars weighed by votes, or by votes', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const tag = crypto.randomUUID().slice(0, 8)

		const shared = (title: string, rating?: { value: number; count: number }) =>
			createSharedRecipe(
				{
					title: `${tag} ${title}`,
					sourceUrl: `https://example.com/${tag}-${title}`,
					ingredients: ['1 lemon'],
					steps: ['cook'],
					rating,
				},
				db,
			)

		const fewFans = await shared('few fans', { value: 5, count: 3 })
		const favourite = await shared('favourite', { value: 4.8, count: 500 })
		const fine = await shared('fine', { value: 4.2, count: 900 })
		await shared('unrated')

		if (!fewFans || !favourite || !fine)
			throw new Error('recipes were not created')

		const mine = [fewFans.id, favourite.id, fine.id]

		const ids = async (query: string, sort: 'loved' | 'votes') =>
			(await findLovedRecipesForUser(userId, query, sort, 200, db))
				.map((recipe) => recipe.id)
				.filter((id) => mine.includes(id))

		// Five stars from three readers ranks under 4.8 from five hundred; what
		// is not rated at all is left out.
		expect(await ids(tag, 'loved')).toEqual([favourite.id, fewFans.id, fine.id])
		// By votes, the most rated first, whatever they gave.
		expect(await ids(tag, 'votes')).toEqual([fine.id, favourite.id, fewFans.id])
		// Without words, it looks through everything.
		expect(await ids('', 'loved')).toEqual([favourite.id, fewFans.id, fine.id])
	})

	test('picks the shelf recipe that uses the most of what is going off', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const recipe = async (title: string, ingredients: string[]) => {
			const made = await createRecipeForUser(userId, { title, ingredients }, db)

			if (!made) throw new Error('recipe was not created')
			await db
				.update(recipes)
				.set({ finalizedAt: new Date() })
				.where(eq(recipes.id, made.id))

			return made
		}

		await recipe('green salad', ['2 cups spinach', '1 lemon'])

		const best = await recipe('salmon with greens', [
			'2 salmon fillets',
			'4 cups baby spinach',
		])

		await expect(
			shelfRecipeUsing(userId, ['spinach', 'salmon', 'cilantro'], db),
		).resolves.toEqual({
			id: best.id,
			title: 'salmon with greens',
			uses: ['spinach', 'salmon'],
		})
		await expect(shelfRecipeUsing(userId, ['tofu'], db)).resolves.toBeNull()
	})

	test('opens unsaved, then saves to the shelf once', async ({ db }) => {
		const userId = await seedUser(db)
		const recipe = await seedShared(db)

		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ saved: false, owned: false, steps: ['simmer'] })
		expect((await listShelfForUser(userId, db)).recipes).toHaveLength(0)

		await saveRecipeForUser(userId, recipe.id, db)
		await saveRecipeForUser(userId, recipe.id, db)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ saved: true })
		expect((await listShelfForUser(userId, db)).recipes).toHaveLength(1)
	})

	test("never shows or saves someone else's own recipe", async ({ db }) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const theirs = await createRecipeForUser(otherId, { title: 'secret' }, db)

		if (!theirs) throw new Error('recipe was not created')
		await expect(getRecipeForUser(userId, theirs.id, db)).resolves.toBeNull()
		await expect(saveRecipeForUser(userId, theirs.id, db)).resolves.toBeNull()
	})

	test('keeps notes personal without copying the recipe', async ({ db }) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		await saveRecipeForUser(otherId, recipe.id, db)

		const saved = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'shared dal',
				notes: 'more cumin',
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			}),
			db,
		)

		expect(saved?.id).toBe(recipe.id)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ notes: 'more cumin' })
		await expect(
			getRecipeForUser(otherId, recipe.id, db),
		).resolves.toMatchObject({ notes: null })
	})

	test('copies a shared recipe on its first edit and moves the shelf and cooks', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		await saveRecipeForUser(otherId, recipe.id, db)
		await db.insert(mealLogs).values({
			id: crypto.randomUUID(),
			userId,
			recipeId: recipe.id,
			cookedAt: new Date(),
		})

		const copy = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'my dal',
				notes: null,
				ingredients: ['lentils', 'salt', 'lime'],
				steps: ['simmer'],
			}),
			db,
		)

		if (!copy) throw new Error('copy was not made')
		expect(copy.id).not.toBe(recipe.id)
		expect(copy).toMatchObject({
			userId,
			forkedFromId: recipe.id,
			sourceUrl: 'https://example.com/dal',
		})
		await expect(getRecipeForUser(userId, copy.id, db)).resolves.toMatchObject({
			title: 'my dal',
			ingredients: ['lentils', 'salt', 'lime'],
			cookCount: 1,
			owned: true,
		})

		const shelf = await listShelfForUser(userId, db)
		expect(shelf.recipes.map((item) => item.id)).toEqual([copy.id])

		await expect(
			getRecipeForUser(otherId, recipe.id, db),
		).resolves.toMatchObject({ title: 'shared dal', saved: true })
		await expect(getRecipeForUser(otherId, copy.id, db)).resolves.toBeNull()

		// Later edits change the copy in place.
		const again = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: copy.id,
				title: 'my dal 2',
				notes: null,
				ingredients: [],
				steps: [],
			}),
			db,
		)

		expect(again?.id).toBe(copy.id)
	})

	test("copies a shared recipe when only an ingredient's group changes", async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		const original = await getRecipeForUser(userId, recipe.id, db)

		const copy = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: original?.title,
				notes: null,
				ingredients: original?.ingredients,
				ingredientCategories: { [original?.ingredients[0] ?? '']: 'other' },
				steps: original?.steps,
			}),
			db,
		)

		expect(copy?.id).not.toBe(recipe.id)
		await expect(
			getRecipeForUser(userId, copy?.id ?? '', db),
		).resolves.toMatchObject({
			ingredientCategories: { [original?.ingredients[0] ?? '']: 'other' },
		})
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ ingredientCategories: {} })
	})

	test('publishes a taken-over copy when the profile publishes by default', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		await saveSharingProfile(
			userId,
			{ handle: 'claim-cook', displayName: 'Claim', autoPublish: true },
			db,
		)

		const claimed = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'shared dal',
				notes: null,
				sourceUrl: null,
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			}),
			db,
		)

		await expect(
			getRecipeShare(userId, claimed?.id ?? '', db),
		).resolves.toMatchObject({ visibility: 'public' })
	})

	test('a source link can be removed, replaced or added back', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		await saveRecipeForUser(otherId, recipe.id, db)

		await db.insert(mealLogs).values({
			id: crypto.randomUUID(),
			userId,
			recipeId: recipe.id,
			cookedAt: new Date(),
		})

		const unlink = (id: string, who: string) =>
			updateRecipeForUser(
				who,
				recipeUpdateInput.parse({
					id,
					title: 'shared dal',
					notes: null,
					sourceUrl: null,
					ingredients: ['lentils', 'salt'],
					steps: ['simmer'],
				}),
				db,
			)

		// Removing a shared recipe's link is a change, so it is copied for them.
		const claimed = await unlink(recipe.id, userId)

		if (!claimed) throw new Error('recipe was not copied')
		expect(claimed.id).not.toBe(recipe.id)
		expect(claimed).toMatchObject({
			userId,
			sourceUrl: null,
			title: 'shared dal',
		})
		await expect(
			getRecipeForUser(userId, claimed.id, db),
		).resolves.toMatchObject({
			owned: true,
			ingredients: ['lentils', 'salt'],
			cookCount: 1,
		})
		expect(
			(await listShelfForUser(userId, db)).recipes.map((item) => item.id),
		).toEqual([claimed.id])
		await expect(
			getRecipeForUser(otherId, recipe.id, db),
		).resolves.toMatchObject({
			saved: true,
			sourceUrl: 'https://example.com/dal',
		})

		// Another cook's copy keeps the link until it is changed.
		const edited = await updateRecipeForUser(
			otherId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'my dal',
				notes: null,
				ingredients: ['lentils'],
				steps: [],
			}),
			db,
		)

		expect(edited).toMatchObject({
			forkedFromId: recipe.id,
			sourceUrl: 'https://example.com/dal',
		})

		const unlinked = await updateRecipeForUser(
			otherId,
			recipeUpdateInput.parse({
				id: edited?.id,
				title: 'my dal',
				notes: null,
				sourceUrl: null,
				ingredients: ['lentils'],
				steps: [],
			}),
			db,
		)

		// Their own copy is changed in place.
		expect(unlinked).toMatchObject({ id: edited?.id, sourceUrl: null })

		// A link can be pointed back at any web page, such as a video.
		const relinked = await updateRecipeForUser(
			otherId,
			recipeUpdateInput.parse({
				id: edited?.id,
				title: 'my dal',
				notes: null,
				sourceUrl: 'https://www.youtube.com/watch?v=abc',
				ingredients: ['lentils'],
				steps: [],
			}),
			db,
		)

		expect(relinked).toMatchObject({
			sourceUrl: 'https://www.youtube.com/watch?v=abc',
		})

		// Someone else's recipe cannot be changed.
		await expect(
			updateRecipeForUser(
				userId,
				recipeUpdateInput.parse({
					id: edited?.id,
					title: 'hijack',
					notes: null,
					sourceUrl: null,
					ingredients: [],
					steps: [],
				}),
				db,
			),
		).resolves.toBeNull()
	})

	test('changing only the link of a shared recipe copies it, and an unchanged link does not', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)

		const same = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'shared dal',
				notes: 'mine',
				sourceUrl: 'https://example.com/dal',
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			}),
			db,
		)

		expect(same?.id).toBe(recipe.id)

		const moved = await updateRecipeForUser(
			userId,
			recipeUpdateInput.parse({
				id: recipe.id,
				title: 'shared dal',
				notes: 'mine',
				sourceUrl: 'https://example.com/better-dal',
				ingredients: ['lentils', 'salt'],
				steps: ['simmer'],
			}),
			db,
		)

		expect(moved?.id).not.toBe(recipe.id)
		expect(moved).toMatchObject({
			forkedFromId: recipe.id,
			sourceUrl: 'https://example.com/better-dal',
		})
	})

	test('gives a published recipe its readable address, to its writer and to others', async ({
		db,
	}) => {
		const writer = await seedUser(db)
		const reader = await seedUser(db)

		await saveSharingProfile(
			writer,
			{ handle: 'dal-cook', displayName: 'Dal', autoPublish: false },
			db,
		)

		const recipe = await createRecipeForUser(writer, { title: 'red dal' }, db)

		if (!recipe) throw new Error('recipe was not created')

		// Private recipes keep the id address.
		await expect(
			getRecipeForUser(writer, recipe.id, db),
		).resolves.toMatchObject({ publicPath: null })

		await setRecipeShare(
			writer,
			{ recipeId: recipe.id, visibility: 'public' },
			db,
		)

		const path = (await getRecipeForUser(writer, recipe.id, db))?.publicPath
		expect(path).toMatch(/^\/dal-cook\/[\w-]+$/)
		await expect(
			getRecipeForUser(reader, recipe.id, db),
		).resolves.toMatchObject({ publicPath: path })
	})

	test('a private share of a saved web recipe is not its readable address', async ({
		db,
	}) => {
		const cook = await seedUser(db)
		const recipe = await seedShared(db)

		await saveSharingProfile(
			cook,
			{ handle: 'web-cook', displayName: 'Web cook', autoPublish: false },
			db,
		)
		await saveRecipeForUser(cook, recipe.id, db)
		await setRecipeShare(
			cook,
			{ recipeId: recipe.id, visibility: 'private' },
			db,
		)

		await expect(getRecipeForUser(cook, recipe.id, db)).resolves.toMatchObject({
			publicPath: null,
		})
	})

	test('credits a writer by their public name, never their account name', async ({
		db,
	}) => {
		const writer = await seedUser(db)
		const reader = await seedUser(db)
		const recipe = await createRecipeForUser(writer, { title: 'red dal' }, db)

		if (!recipe) throw new Error('recipe was not created')

		// No public profile yet: no credit, and the account name stays private.
		await expect(
			getRecipeForUser(writer, recipe.id, db),
		).resolves.toMatchObject({ authorName: null })

		await saveSharingProfile(
			writer,
			{ handle: 'credit-cook', displayName: 'Dal Cook', autoPublish: false },
			db,
		)

		// A profile with no public recipe is still not public, so not credited.
		await expect(
			getRecipeForUser(writer, recipe.id, db),
		).resolves.toMatchObject({ authorName: null })

		await setRecipeShare(
			writer,
			{ recipeId: recipe.id, visibility: 'public' },
			db,
		)

		const seen = await getRecipeForUser(reader, recipe.id, db)

		expect(seen).toMatchObject({ authorName: 'Dal Cook' })
		expect(JSON.stringify(seen)).not.toContain('Test User')
	})

	test('removing a shared recipe only takes it off your shelf', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)

		await expect(deleteRecipeForUser(userId, recipe.id, db)).resolves.toEqual({
			id: recipe.id,
		})
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ saved: false })
		await expect(
			findSharedRecipeByUrl('https://example.com/dal', db),
		).resolves.not.toBeNull()
	})
})
