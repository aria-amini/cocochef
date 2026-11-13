import {
	describe,
	expect,
	test,
	type Database,
} from '@tests/support/fixtures/db'
import { eq } from 'drizzle-orm'

import { recipes, user } from '@/db/schema'
import {
	copyRecipeForUser,
	createRecipeForUser,
	createSharedRecipe,
	deleteRecipeForUser,
	findRecipesForUser,
	getRecipeForUser,
	listShelfForUser,
	saveRecipeForUser,
	updateRecipeForUser,
} from '@/lib/recipes/repository'

import {
	getPublishedRecipe,
	getPublicProfile,
	hasPublicRecipe,
	getRecipeShare,
	getWebRecipe,
	getWebRecipeLink,
	saveSharingProfile,
	setRecipeShare,
} from './repository'

async function account(db: Database) {
	const id = crypto.randomUUID()
	await db.insert(user).values({
		id,
		name: 'Private account name',
		email: `${id}@example.com`,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	return id
}

async function profile(db: Database, autoPublish = false) {
	const userId = await account(db)
	const handle = `cook-${userId.slice(0, 8)}`
	await saveSharingProfile(
		userId,
		{ handle, displayName: 'A public kitchen', autoPublish },
		db,
	)

	return { userId, handle }
}

async function recipe(db: Database, userId: string, finalized = true) {
	const row = await createRecipeForUser(
		userId,
		{
			title: 'Weeknight pasta',
			ingredients: ['1 onion'],
			steps: ['Chop'],
			notes: 'Private medical notes',
			sourceNotes: 'Publisher cooking tip',
			finalized,
		},
		db,
	)

	if (!row) throw new Error('recipe missing')

	return row
}

const edits = (id: string, title = 'Weeknight pasta') => ({
	id,
	title,
	ingredients: ['1 onion'],
	steps: ['Chop'],
	notes: 'Private medical notes',
	finalize: true,
})

describe('recipe publication boundaries', () => {
	test('private by default; public reads expose recipe content and a chosen name only', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		const row = await recipe(db, userId)
		expect(await getPublicProfile(handle, db)).toBeNull()
		expect(await getRecipeForUser(await account(db), row.id, db)).toBeNull()

		const share = await setRecipeShare(
			userId,
			{ recipeId: row.id, visibility: 'public' },
			db,
		)

		expect(share.slug).toBe('weeknight-pasta')
		const published = await getPublishedRecipe({ handle, slug: share.slug }, db)
		expect(published).toMatchObject({
			title: row.title,
			sourceNotes: 'Publisher cooking tip',
			ingredients: ['1 onion'],
			steps: ['Chop'],
			publisher: { displayName: 'A public kitchen' },
		})

		const serialized = JSON.stringify([
			published,
			await getPublicProfile(handle, db),
		])

		for (const secret of [
			'Private medical notes',
			'Private account name',
			'@example.com',
			'cookCount',
			'lastCookedAt',
			'userId',
			'token',
		])
			expect(serialized).not.toContain(secret)
	})
	test('credits the original author on a published copy', async ({ db }) => {
		const author = await profile(db)
		const copier = await profile(db)
		await saveSharingProfile(
			author.userId,
			{
				handle: author.handle,
				displayName: 'Original cook',
				autoPublish: false,
			},
			db,
		)
		const source = await recipe(db, author.userId)
		await setRecipeShare(
			author.userId,
			{ recipeId: source.id, visibility: 'public' },
			db,
		)
		const copy = await copyRecipeForUser(copier.userId, source.id, db)

		if (!copy) throw new Error('missing copy')

		const share = await setRecipeShare(
			copier.userId,
			{ recipeId: copy.id, visibility: 'public' },
			db,
		)

		await expect(
			getPublishedRecipe({ handle: copier.handle, slug: share.slug }, db),
		).resolves.toMatchObject({ originalAuthorName: 'Original cook' })

		// Once the author has no public recipe left, their profile is not public
		// and the credit goes with it; the copy itself stays published.
		await setRecipeShare(
			author.userId,
			{ recipeId: source.id, visibility: 'private' },
			db,
		)
		await expect(
			getPublishedRecipe({ handle: copier.handle, slug: share.slug }, db),
		).resolves.toMatchObject({ originalAuthorName: null })
	})

	test('unpublishing removes access through saved shelves, search, direct reads, and public pages', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		const viewer = await account(db)
		const row = await recipe(db, userId)

		const share = await setRecipeShare(
			userId,
			{ recipeId: row.id, visibility: 'public' },
			db,
		)

		await saveRecipeForUser(viewer, row.id, db)
		expect((await listShelfForUser(viewer, db)).recipes).toHaveLength(1)
		expect(
			(await findRecipesForUser(viewer, 'pasta', 100, db)).some(
				(found) => found.id === row.id,
			),
		).toBe(true)
		await setRecipeShare(
			userId,
			{ recipeId: row.id, visibility: 'private' },
			db,
		)
		expect((await listShelfForUser(viewer, db)).recipes).toEqual([])
		expect(
			(await findRecipesForUser(viewer, 'pasta', 100, db)).some(
				(found) => found.id === row.id,
			),
		).toBe(false)
		expect(await getRecipeForUser(viewer, row.id, db)).toBeNull()
		expect(
			await getPublishedRecipe({ handle, slug: share.slug }, db),
		).toBeNull()
	})
	test('auto-publishing applies at finish, never to old finished recipes, imports, or explicit private choices', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		const old = await recipe(db, userId)
		await saveSharingProfile(
			userId,
			{ handle, displayName: 'A public kitchen', autoPublish: true },
			db,
		)
		await updateRecipeForUser(userId, edits(old.id), db)
		expect(await getRecipeShare(userId, old.id, db)).toBeNull()
		const draft = await recipe(db, userId, false)
		expect(await getRecipeShare(userId, draft.id, db)).toBeNull()
		await updateRecipeForUser(userId, edits(draft.id), db)
		expect(await getRecipeShare(userId, draft.id, db)).toMatchObject({
			visibility: 'public',
		})
		await setRecipeShare(
			userId,
			{ recipeId: draft.id, visibility: 'private' },
			db,
		)
		await updateRecipeForUser(userId, edits(draft.id), db)
		expect(await getRecipeShare(userId, draft.id, db)).toMatchObject({
			visibility: 'private',
		})

		const imported = await createSharedRecipe(
			{ title: 'Web recipe', sourceUrl: 'https://example.com/recipe' },
			db,
		)

		if (!imported) throw new Error('missing import')
		await saveRecipeForUser(userId, imported.id, db)
		expect(await getRecipeShare(userId, imported.id, db)).toBeNull()
		const fresh = await recipe(db, userId)
		expect(await getRecipeShare(userId, fresh.id, db)).toMatchObject({
			visibility: 'public',
		})
		await saveSharingProfile(
			userId,
			{ handle, displayName: 'A public kitchen', autoPublish: false },
			db,
		)
		expect(await getRecipeShare(userId, fresh.id, db)).toMatchObject({
			visibility: 'public',
		})
		expect(
			await getRecipeShare(userId, (await recipe(db, userId)).id, db),
		).toBeNull()
	})
	test('only real accounts can publish their finished recipes; drafts and another user’s content stay private', async ({
		db,
	}) => {
		const { userId } = await profile(db)
		const other = await profile(db)
		const row = await recipe(db, userId)
		await expect(
			setRecipeShare(
				other.userId,
				{ recipeId: row.id, visibility: 'public' },
				db,
			),
		).rejects.toThrow('own')
		const draft = await recipe(db, userId, false)
		await expect(
			setRecipeShare(userId, { recipeId: draft.id, visibility: 'public' }, db),
		).rejects.toThrow('finish')
	})
	test('handles and slugs are stable, unique, and cannot claim app routes', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		await expect(
			saveSharingProfile(
				userId,
				{ handle: 'recipes', displayName: 'No', autoPublish: false },
				db,
			),
		).rejects.toThrow()
		await expect(
			saveSharingProfile(
				await account(db),
				{ handle, displayName: 'Duplicate', autoPublish: false },
				db,
			),
		).rejects.toThrow()
		const first = await recipe(db, userId)
		const second = await recipe(db, userId)

		const a = await setRecipeShare(
			userId,
			{ recipeId: first.id, visibility: 'public' },
			db,
		)

		const b = await setRecipeShare(
			userId,
			{ recipeId: second.id, visibility: 'public' },
			db,
		)

		await expect(
			saveSharingProfile(
				userId,
				{ handle: 'changed-handle', displayName: 'No', autoPublish: false },
				db,
			),
		).resolves.toMatchObject({ handle: 'changed-handle' })
		await expect(
			getPublishedRecipe({ handle, slug: a.slug }, db),
		).resolves.toBeNull()
		expect(a.slug).not.toBe(b.slug)
		await updateRecipeForUser(userId, edits(first.id, 'Changed name'), db)
		expect(
			await getPublishedRecipe({ handle: 'changed-handle', slug: a.slug }, db),
		).toMatchObject({ title: 'Changed name' })
	})
	test('source links credit the website and do not publish anyone’s saving history', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)

		const imported = await createSharedRecipe(
			{
				title: 'Meatballs',
				sourceUrl: 'https://www.seriouseats.com/meatballs',
				rating: { value: 4.8, count: 210 },
				commentCount: 37,
				ingredients: ['1 onion'],
				steps: ['Cook'],
			},
			db,
		)

		if (!imported) throw new Error('missing import')
		const link = await getWebRecipeLink(userId, imported.id, db)
		expect(link).toMatchObject({ site: 'serious-eats', slug: 'meatballs' })
		expect(await getWebRecipe('serious-eats', 'meatballs', db)).toMatchObject({
			title: 'Meatballs',
			sourceUrl: imported.sourceUrl,
			// What its readers said shows on the page too.
			ratingValue: 4.8,
			ratingCount: 210,
			commentCount: 37,
		})
		expect(await getPublicProfile(handle, db)).toBeNull()
		await expect(
			setRecipeShare(
				userId,
				{ recipeId: imported.id, visibility: 'public' },
				db,
			),
		).rejects.toThrow('save')
		await saveRecipeForUser(userId, imported.id, db)

		const share = await setRecipeShare(
			userId,
			{ recipeId: imported.id, visibility: 'public' },
			db,
		)

		expect(await getPublicProfile(handle, db)).toMatchObject({
			recipes: [{ slug: share.slug }],
		})
		await deleteRecipeForUser(userId, imported.id, db)
		expect(await getPublicProfile(handle, db)).toBeNull()
		expect(await getWebRecipeLink(userId, imported.id, db)).toEqual(link)
	})
	test('a profile is public only once one of its recipes is', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		const row = await recipe(db, userId)

		expect(await hasPublicRecipe(userId, db)).toBe(false)
		expect(await getPublicProfile(handle, db)).toBeNull()

		await setRecipeShare(userId, { recipeId: row.id, visibility: 'public' }, db)
		expect(await hasPublicRecipe(userId, db)).toBe(true)
		expect(await getPublicProfile(handle, db)).toMatchObject({
			displayName: 'A public kitchen',
		})

		await setRecipeShare(
			userId,
			{ recipeId: row.id, visibility: 'private' },
			db,
		)
		expect(await hasPublicRecipe(userId, db)).toBe(false)
		expect(await getPublicProfile(handle, db)).toBeNull()
	})
	test('stale publications cannot expose drafts or recipes transferred to a different owner', async ({
		db,
	}) => {
		const { userId, handle } = await profile(db)
		const row = await recipe(db, userId)

		const share = await setRecipeShare(
			userId,
			{ recipeId: row.id, visibility: 'public' },
			db,
		)

		await db
			.update(recipes)
			.set({ finalizedAt: null })
			.where(eq(recipes.id, row.id))
		expect(
			await getPublishedRecipe({ handle, slug: share.slug }, db),
		).toBeNull()
		await db
			.update(recipes)
			.set({ finalizedAt: new Date(), userId: await account(db) })
			.where(eq(recipes.id, row.id))
		expect(
			await getPublishedRecipe({ handle, slug: share.slug }, db),
		).toBeNull()
		expect(await getPublicProfile(handle, db)).toBeNull()
	})
})
