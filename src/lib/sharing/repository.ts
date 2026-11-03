import { and, asc, desc, eq, isNotNull, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import { getDb, type Database } from '@/db/connection'
import {
	recipeIngredients,
	recipes,
	recipeShares,
	recipeSteps,
	sharingProfiles,
	shelfRecipes,
	user,
	webRecipeLinks,
} from '@/db/schema'

import { recipeShareInput, sharingProfileInput, sharingSlug } from './schema'

type SharingDatabase =
	| Database
	| Parameters<Parameters<Database['transaction']>[0]>[0]

export async function getSharingProfile(
	userId: string,
	database: SharingDatabase = getDb(),
) {
	const [profile] = await database
		.select()
		.from(sharingProfiles)
		.where(eq(sharingProfiles.userId, userId))

	return profile ?? null
}

async function requireAccount(userId: string, database: SharingDatabase) {
	const [account] = await database
		.select({ anonymous: user.isAnonymous })
		.from(user)
		.where(eq(user.id, userId))

	if (!account || account.anonymous) throw new Error('sign in to share recipes')
}

export async function saveSharingProfile(
	userId: string,
	input: z.infer<typeof sharingProfileInput>,
	database: Database = getDb(),
) {
	const data = sharingProfileInput.parse(input)
	await requireAccount(userId, database)

	return database.transaction(async (tx) => {
		const existing = await getSharingProfile(userId, tx)

		if (existing && existing.handle !== data.handle)
			throw new Error('your public handle cannot be changed')

		const [profile] = await tx
			.insert(sharingProfiles)
			.values({ userId, ...data })
			.onConflictDoUpdate({
				target: sharingProfiles.userId,
				set: { displayName: data.displayName, autoPublish: data.autoPublish },
			})
			.returning()

		return profile!
	})
}

async function shareableRecipe(
	userId: string,
	recipeId: string,
	database: SharingDatabase,
) {
	const [recipe] = await database
		.select()
		.from(recipes)
		.where(
			and(
				eq(recipes.id, recipeId),
				isNotNull(recipes.finalizedAt),
				or(eq(recipes.userId, userId), isNull(recipes.userId)),
			),
		)

	if (!recipe) throw new Error('finish a recipe you own before sharing it')

	return recipe
}

export async function getRecipeShare(
	userId: string,
	recipeId: string,
	database: SharingDatabase = getDb(),
) {
	const [share] = await database
		.select()
		.from(recipeShares)
		.where(
			and(eq(recipeShares.userId, userId), eq(recipeShares.recipeId, recipeId)),
		)

	return share ?? null
}

async function writeRecipeShare(
	userId: string,
	recipe: typeof recipes.$inferSelect,
	visibility: (typeof recipeShares.$inferSelect)['visibility'],
	database: SharingDatabase,
) {
	const existing = await getRecipeShare(userId, recipe.id, database)

	if (existing) {
		const [share] = await database
			.update(recipeShares)
			.set({
				visibility,
				token:
					existing.visibility === visibility
						? existing.token
						: crypto.randomUUID(),
			})
			.where(eq(recipeShares.id, existing.id))
			.returning()

		return share!
	}

	const base = sharingSlug(recipe.title)

	// Only title collisions need a suffix; the first title keeps the short address.
	for (let attempt = 0; attempt < 6; attempt++) {
		const slug = attempt ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base

		const [share] = await database
			.insert(recipeShares)
			.values({
				id: crypto.randomUUID(),
				userId,
				recipeId: recipe.id,
				slug,
				visibility,
				token: crypto.randomUUID(),
				createdAt: new Date(),
			})
			.onConflictDoNothing()
			.returning()

		if (share) return share
		const concurrent = await getRecipeShare(userId, recipe.id, database)

		if (concurrent)
			return writeRecipeShare(userId, recipe, visibility, database)
	}

	throw new Error('could not create a sharing address — try again')
}

export async function setRecipeShare(
	userId: string,
	input: z.infer<typeof recipeShareInput>,
	database: Database = getDb(),
) {
	const data = recipeShareInput.parse(input)
	await requireAccount(userId, database)

	return database.transaction(async (tx) => {
		const recipe = await shareableRecipe(userId, data.recipeId, tx)

		if (!(await getSharingProfile(userId, tx)))
			throw new Error('choose a public handle in your profile first')

		if (recipe.userId === null) {
			const [saved] = await tx
				.select({ id: shelfRecipes.id })
				.from(shelfRecipes)
				.where(
					and(
						eq(shelfRecipes.userId, userId),
						eq(shelfRecipes.recipeId, recipe.id),
					),
				)

			if (!saved)
				throw new Error('save this recipe before adding it to your profile')
		}

		return writeRecipeShare(userId, recipe, data.visibility, tx)
	})
}

// Called inside recipe writes. Existing visibility choices always win; preferences
// apply only when a new recipe is finished, never retroactively or to imports.
export async function publishFinishedRecipe(
	userId: string,
	recipe: typeof recipes.$inferSelect,
	database: SharingDatabase,
) {
	if (!recipe.finalizedAt || recipe.userId !== userId) return
	const profile = await getSharingProfile(userId, database)

	if (
		!profile?.autoPublish ||
		(await getRecipeShare(userId, recipe.id, database))
	)
		return
	await writeRecipeShare(userId, recipe, 'public', database)
}

const publicFields = {
	id: recipes.id,
	title: recipes.title,
	imageUrl: recipes.imageUrl,
	sourceUrl: recipes.sourceUrl,
	sourceNotes: recipes.sourceNotes,
	servings: recipes.servings,
	totalMinutes: recipes.totalMinutes,
}

async function publicContent(
	recipe: Pick<typeof recipes.$inferSelect, keyof typeof publicFields>,
	database: SharingDatabase,
) {
	const [ingredients, steps] = await Promise.all([
		database
			.select({ text: recipeIngredients.text })
			.from(recipeIngredients)
			.where(eq(recipeIngredients.recipeId, recipe.id))
			.orderBy(asc(recipeIngredients.position)),
		database
			.select({ text: recipeSteps.text })
			.from(recipeSteps)
			.where(eq(recipeSteps.recipeId, recipe.id))
			.orderBy(asc(recipeSteps.position)),
	])

	return {
		...recipe,
		ingredients: ingredients.map((line) => line.text),
		steps: steps.map((line) => line.text),
	}
}

export async function getPublicProfile(
	handle: string,
	database: SharingDatabase = getDb(),
) {
	const [profile] = await database
		.select({
			handle: sharingProfiles.handle,
			displayName: sharingProfiles.displayName,
			userId: sharingProfiles.userId,
		})
		.from(sharingProfiles)
		.where(eq(sharingProfiles.handle, handle))

	if (!profile) return null

	const published = await database
		.select({ ...publicFields, slug: recipeShares.slug })
		.from(recipeShares)
		.innerJoin(recipes, eq(recipes.id, recipeShares.recipeId))
		.where(
			and(
				eq(recipeShares.userId, profile.userId),
				eq(recipeShares.visibility, 'public'),
				isNotNull(recipes.finalizedAt),
				or(eq(recipes.userId, profile.userId), isNull(recipes.userId)),
			),
		)
		.orderBy(desc(recipeShares.createdAt))

	return {
		handle: profile.handle,
		displayName: profile.displayName,
		recipes: published,
	}
}

export async function getPublishedRecipe(
	address: { handle: string; slug: string } | { token: string },
	database: SharingDatabase = getDb(),
) {
	const [row] = await database
		.select({
			recipe: publicFields,
			handle: sharingProfiles.handle,
			displayName: sharingProfiles.displayName,
		})
		.from(recipeShares)
		.innerJoin(sharingProfiles, eq(sharingProfiles.userId, recipeShares.userId))
		.innerJoin(recipes, eq(recipes.id, recipeShares.recipeId))
		.where(
			and(
				'token' in address
					? and(
							eq(recipeShares.token, address.token),
							eq(recipeShares.visibility, 'unlisted'),
						)
					: and(
							eq(sharingProfiles.handle, address.handle),
							eq(recipeShares.slug, address.slug),
							eq(recipeShares.visibility, 'public'),
						),
				isNotNull(recipes.finalizedAt),
				or(eq(recipes.userId, sharingProfiles.userId), isNull(recipes.userId)),
			),
		)

	return row
		? {
				...(await publicContent(row.recipe, database)),
				publisher: { handle: row.handle, displayName: row.displayName },
			}
		: null
}

export async function getWebRecipeLink(
	userId: string,
	recipeId: string,
	database: Database = getDb(),
) {
	const recipe = await shareableRecipe(userId, recipeId, database)

	if (recipe.userId !== null || !recipe.sourceUrl) return null

	const [existing] = await database
		.select()
		.from(webRecipeLinks)
		.where(eq(webRecipeLinks.recipeId, recipeId))

	if (existing) return existing
	const host = new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')

	const site = host === 'seriouseats.com' ? 'serious-eats' : host

	for (let attempt = 0; attempt < 6; attempt++) {
		const slug = `${sharingSlug(recipe.title)}${attempt ? `-${crypto.randomUUID().slice(0, 8)}` : ''}`

		const [link] = await database
			.insert(webRecipeLinks)
			.values({ recipeId, site, slug })
			.onConflictDoNothing()
			.returning()

		if (link) return link

		const [concurrent] = await database
			.select()
			.from(webRecipeLinks)
			.where(eq(webRecipeLinks.recipeId, recipeId))

		if (concurrent) return concurrent
	}

	throw new Error('could not create a sharing address — try again')
}

export async function getWebRecipe(
	site: string,
	slug: string,
	database: SharingDatabase = getDb(),
) {
	const [recipe] = await database
		.select(publicFields)
		.from(webRecipeLinks)
		.innerJoin(recipes, eq(recipes.id, webRecipeLinks.recipeId))
		.where(
			and(
				eq(webRecipeLinks.site, site),
				eq(webRecipeLinks.slug, slug),
				isNull(recipes.userId),
				isNotNull(recipes.finalizedAt),
			),
		)

	return recipe ? publicContent(recipe, database) : null
}
