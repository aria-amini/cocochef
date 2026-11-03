import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'

import { user } from '@/db/schema'
import { getRecipeShare, saveSharingProfile } from '@/lib/sharing/repository'

import {
	createCollectionForUser,
	createRecipeForUser,
	createSharedRecipe,
	getRecipeForUser,
	listCollectionsForUser,
	listShelfForUser,
	saveRecipeForUser,
} from './repository'
import { parseTransferDocument } from './transfer'
import {
	exportRecipesForUser,
	importRecipesForUser,
} from './transfer-repository'

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

// What travels is the file's text, as it would between two deployments.
async function carry(db: Database, from: string) {
	const parsed = parseTransferDocument(
		JSON.stringify(await exportRecipesForUser(from, undefined, db)),
	)

	if (!parsed.ok) throw new Error(parsed.error)

	return parsed.recipes
}

describe('moving recipes between kitchens', () => {
	test('carries a recipe, its notes, groups and book to another kitchen', async ({
		db,
	}) => {
		const preview = await seedUser(db)
		const prod = await seedUser(db)
		const book = await createCollectionForUser(preview, 'soups', db)

		await createRecipeForUser(
			preview,
			{
				title: 'Ash Resteh',
				sourceUrl: 'https://example.com/resteh',
				imageUrl: `recipes/${preview}-photo`,
				notes: 'less salt',
				sourceNotes: 'Publisher tip\nKeep chilled.',
				collectionId: book?.id,
				ingredients: ['## sauce', '2 large eggs'],
				ingredientCategories: { '2 large eggs': 'other' },
				steps: ['simmer'],
			},
			db,
		)
		await createRecipeForUser(
			preview,
			{ title: 'half done', finalized: false, ingredients: ['1 onion'] },
			db,
		)

		await expect(
			importRecipesForUser(prod, await carry(db, preview), db),
		).resolves.toEqual({ imported: 2, skipped: 0 })

		const shelf = await listShelfForUser(prod, db)
		expect(shelf.recipes.map((recipe) => recipe.title).sort()).toEqual([
			'Ash Resteh',
			'half done',
		])

		const resteh = shelf.recipes.find((recipe) => recipe.title === 'Ash Resteh')
		const copied = await getRecipeForUser(prod, resteh?.id ?? '', db)

		expect(copied).toMatchObject({
			owned: true,
			notes: 'less salt',
			sourceNotes: 'Publisher tip\nKeep chilled.',
			sourceUrl: 'https://example.com/resteh',
			// A photo stored on the other deployment cannot come along.
			imageUrl: null,
			ingredients: ['## sauce', '2 large eggs'],
			ingredientCategories: { '2 large eggs': 'other' },
			steps: ['simmer'],
		})
		await expect(listCollectionsForUser(prod, db)).resolves.toMatchObject([
			{ name: 'soups' },
		])
		expect(copied?.collectionId).toBe(
			(await listCollectionsForUser(prod, db))[0]?.id,
		)

		const draft = shelf.recipes.find((recipe) => recipe.title === 'half done')
		expect(draft?.finalizedAt).toBeNull()
	})

	test('does not double a recipe that is already there', async ({ db }) => {
		const preview = await seedUser(db)
		const prod = await seedUser(db)
		await createRecipeForUser(
			preview,
			{ title: 'dal', ingredients: ['lentils'], steps: ['simmer'] },
			db,
		)

		const file = await carry(db, preview)

		await importRecipesForUser(prod, file, db)
		await expect(importRecipesForUser(prod, file, db)).resolves.toEqual({
			imported: 0,
			skipped: 1,
		})
		expect((await listShelfForUser(prod, db)).recipes).toHaveLength(1)

		// A different recipe with the same name is not a duplicate.
		await expect(
			importRecipesForUser(
				prod,
				[{ title: 'dal', ingredients: ['red lentils'], steps: ['simmer'] }],
				db,
			),
		).resolves.toEqual({ imported: 1, skipped: 0 })
	})

	test('does not double a recipe saved from the web', async ({ db }) => {
		const cook = await seedUser(db)

		const shared = await createSharedRecipe(
			{
				title: 'web dal',
				sourceUrl: 'https://example.com/dal',
				ingredients: ['lentils'],
				steps: ['simmer'],
			},
			db,
		)

		await saveRecipeForUser(cook, shared!.id, db)

		await expect(
			importRecipesForUser(cook, await carry(db, cook), db),
		).resolves.toEqual({ imported: 0, skipped: 1 })
	})

	test('keeps imported recipes private on an auto-publish profile', async ({
		db,
	}) => {
		const preview = await seedUser(db)
		const prod = await seedUser(db)
		await createRecipeForUser(preview, { title: 'dal' }, db)
		await saveSharingProfile(
			prod,
			{ handle: 'prod-cook', displayName: 'Prod', autoPublish: true },
			db,
		)

		await importRecipesForUser(prod, await carry(db, preview), db)

		const [imported] = (await listShelfForUser(prod, db)).recipes
		expect(imported).toBeDefined()
		await expect(getRecipeShare(prod, imported!.id, db)).resolves.toBeNull()

		// A recipe written here still follows the profile's setting.
		const written = await createRecipeForUser(prod, { title: 'soup' }, db)
		await expect(getRecipeShare(prod, written!.id, db)).resolves.not.toBeNull()
	})

	test('exports one recipe a cook can see, and nothing they cannot', async ({
		db,
	}) => {
		const cook = await seedUser(db)
		const other = await seedUser(db)

		const mine = await createRecipeForUser(cook, { title: 'mine' }, db)
		const theirs = await createRecipeForUser(other, { title: 'theirs' }, db)

		const one = await exportRecipesForUser(cook, mine?.id, db)
		expect(one.recipes.map((recipe) => recipe.title)).toEqual(['mine'])

		const hidden = await exportRecipesForUser(cook, theirs?.id, db)
		expect(hidden.recipes).toEqual([])
	})
})
