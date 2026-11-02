import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'

import { mealLogs, user } from '@/db/schema'

import { recipeUpdateInput } from './model'
import {
	createCollectionForUser,
	createRecipeForUser,
	deleteCollectionForUser,
	deleteRecipeForUser,
	getRecipeForUser,
	listCollectionsForUser,
	listShelfForUser,
	popularSharedRecipes,
	moveRecipeForUser,
	renameCollectionForUser,
	saveRecipeForUser,
	createSharedRecipe,
	findSharedRecipeByUrl,
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
	test('creates collections in order and shelves recipes in them', async ({
		db,
	}) => {
		const userId = await seedUser(db)

		const weeknight = await createCollectionForUser(
			userId,
			'weeknight heroes',
			db,
		)

		const sunday = await createCollectionForUser(userId, 'slow sunday', db)
		expect(weeknight?.position).toBe(0)
		expect(sunday?.position).toBe(1)

		const recipe = await createRecipeForUser(
			userId,
			{ title: 'miso butter pasta', collectionId: weeknight?.id },
			db,
		)

		if (!recipe) throw new Error('recipe was not created')
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ collectionId: weeknight?.id, saved: true })

		const shelf = await listShelfForUser(userId, db)
		expect(shelf.collections.map((c) => c.name)).toEqual([
			'weeknight heroes',
			'slow sunday',
		])
		expect(shelf.recipes).toHaveLength(1)
	})

	test('shelves recipes without a group', async ({ db }) => {
		const userId = await seedUser(db)
		const recipe = await createRecipeForUser(userId, { title: 'dal' }, db)

		if (!recipe) throw new Error('recipe was not created')
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ collectionId: null })
	})

	test('scopes the shelf to the user', async ({ db }) => {
		const userId = await seedUser(db)
		await createRecipeForUser(userId, { title: 'dal' }, db)

		const other = await listShelfForUser('user-2', db)
		expect(other.recipes).toHaveLength(0)
		expect(other.collections).toHaveLength(0)
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

	test('rejects collections owned by another user', async ({ db }) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const foreign = await createCollectionForUser(otherId, 'not yours', db)

		await expect(
			createRecipeForUser(
				userId,
				{ title: 'dal', collectionId: foreign?.id },
				db,
			),
		).rejects.toThrow('collection not found')
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

describe('books', () => {
	test('renames, moves recipes, and deletes without losing recipes', async ({
		db,
	}) => {
		const userId = await seedUser(db)
		const book = await createCollectionForUser(userId, 'weeknight', db)
		const recipe = await createRecipeForUser(userId, { title: 'dal' }, db)

		if (!book || !recipe) throw new Error('seed failed')

		await expect(
			renameCollectionForUser(userId, book.id, 'school nights', db),
		).resolves.toMatchObject({ name: 'school nights' })
		await expect(
			moveRecipeForUser(userId, recipe.id, book.id, db),
		).resolves.toMatchObject({ collectionId: book.id })

		await expect(deleteCollectionForUser(userId, book.id, db)).resolves.toEqual(
			{ id: book.id },
		)
		await expect(
			getRecipeForUser(userId, recipe.id, db),
		).resolves.toMatchObject({ title: 'dal', collectionId: null })
	})

	test("ignores other users' books and recipes", async ({ db }) => {
		const userId = await seedUser(db)
		const otherId = await seedUser(db)
		const foreignBook = await createCollectionForUser(otherId, 'theirs', db)
		const recipe = await createRecipeForUser(userId, { title: 'dal' }, db)

		const foreignRecipe = await createRecipeForUser(
			otherId,
			{ title: 'stew' },
			db,
		)

		if (!foreignBook || !recipe || !foreignRecipe) {
			throw new Error('seed failed')
		}

		await expect(
			moveRecipeForUser(userId, recipe.id, foreignBook.id, db),
		).rejects.toThrow('collection not found')
		await expect(
			moveRecipeForUser(userId, foreignRecipe.id, null, db),
		).resolves.toBeNull()
		await expect(
			renameCollectionForUser(userId, foreignBook.id, 'mine', db),
		).resolves.toBeNull()
		await expect(
			deleteCollectionForUser(userId, foreignBook.id, db),
		).resolves.toBeNull()
		await expect(listCollectionsForUser(otherId, db)).resolves.toHaveLength(1)
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
		const book = await createCollectionForUser(userId, 'weeknight', db)
		const recipe = await seedShared(db)
		await saveRecipeForUser(userId, recipe.id, db)
		await saveRecipeForUser(otherId, recipe.id, db)
		await moveRecipeForUser(userId, recipe.id, book?.id ?? null, db)
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
			collectionId: book?.id,
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
