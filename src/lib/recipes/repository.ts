import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	getColumns,
	gt,
	ilike,
	inArray,
	isNull,
	max,
	or,
	sql,
} from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import {
	collections,
	mealLogs,
	recipeIngredients,
	recipeSteps,
	recipes,
	shelfRecipes,
} from '@/db/schema'
import { ownsRecipePhoto, type RecipeUpdate } from '@/lib/recipes/model'

type RecipeDatabase =
	| Database
	| Parameters<Parameters<Database['transaction']>[0]>[0]

// Shared recipes are everyone's; a written or copied recipe only its writer's.
function visibleTo(userId: string) {
	return or(isNull(recipes.userId), eq(recipes.userId, userId))
}

function cookStatsForUser(database: Database, userId: string) {
	return database
		.select({
			recipeId: mealLogs.recipeId,
			cookCount: count().as('cook_count'),
			lastCookedAt: max(mealLogs.cookedAt).as('last_cooked_at'),
		})
		.from(mealLogs)
		.where(eq(mealLogs.userId, userId))
		.groupBy(mealLogs.recipeId)
		.as('cook_stats')
}

// A recipe as one user sees it: the shared content, plus their shelf row (book
// and notes, when saved) and how often they cooked it.
function recipesForUser(database: Database, userId: string) {
	const stats = cookStatsForUser(database, userId)

	return database
		.select({
			...getColumns(recipes),
			collectionId: shelfRecipes.collectionId,
			notes: shelfRecipes.notes,
			savedAt: shelfRecipes.addedAt,
			cookCount: sql<number>`coalesce(${stats.cookCount}, 0)`.mapWith(Number),
			lastCookedAt: stats.lastCookedAt,
		})
		.from(recipes)
		.leftJoin(
			shelfRecipes,
			and(
				eq(shelfRecipes.recipeId, recipes.id),
				eq(shelfRecipes.userId, userId),
			),
		)
		.leftJoin(stats, eq(stats.recipeId, recipes.id))
		.$dynamic()
}

export async function listShelfForUser(
	userId: string,
	database: Database = getDb(),
) {
	const [userCollections, userRecipes] = await Promise.all([
		listCollectionsForUser(userId, database),
		recipesForUser(database, userId)
			.where(eq(shelfRecipes.userId, userId))
			.orderBy(desc(shelfRecipes.addedAt)),
	])

	return { collections: userCollections, recipes: userRecipes }
}

async function recipeContent(database: RecipeDatabase, recipeId: string) {
	const [ingredients, steps] = await Promise.all([
		database
			.select({ text: recipeIngredients.text })
			.from(recipeIngredients)
			.where(eq(recipeIngredients.recipeId, recipeId))
			.orderBy(asc(recipeIngredients.position)),
		database
			.select({ text: recipeSteps.text })
			.from(recipeSteps)
			.where(eq(recipeSteps.recipeId, recipeId))
			.orderBy(asc(recipeSteps.position)),
	])

	return {
		ingredients: ingredients.map((item) => item.text),
		steps: steps.map((step) => step.text),
	}
}

export async function getRecipeForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	const [recipe] = await recipesForUser(database, userId).where(
		and(eq(recipes.id, id), visibleTo(userId)),
	)

	if (!recipe) return null

	return {
		...recipe,
		...(await recipeContent(database, recipe.id)),
		saved: recipe.savedAt !== null,
		owned: recipe.userId === userId,
	}
}

// Which of these pages are already shared recipes.
export async function sharedRecipeUrls(
	urls: string[],
	database: Database = getDb(),
) {
	if (urls.length === 0) return []

	const rows = await database
		.select({ sourceUrl: recipes.sourceUrl })
		.from(recipes)
		.where(and(isNull(recipes.userId), inArray(recipes.sourceUrl, urls)))

	return rows.flatMap((row) => row.sourceUrl ?? [])
}

// Search words: lowercase letters and digits, two or more long, a few at most.
function searchTerms(query: string) {
	const terms = query
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((term) => term.length > 1)

	return [...new Set(terms)].slice(0, 6)
}

const likePattern = (term: string) =>
	`%${term.replaceAll(/[\\%_]/g, (match) => `\\${match}`)}%`

// Recipes this user can open whose name or ingredients hold every word, so
// "chicken thighs lemon" finds what cooks with them. Names that hold more of
// the words rank first, then what is on the shelf, then the newest. Each says
// which words only its ingredients matched.
export async function findRecipesForUser(
	userId: string,
	query: string,
	limit = 20,
	database: Database = getDb(),
) {
	const terms = searchTerms(query)

	if (terms.length === 0) return []

	const inTitle = (term: string) => ilike(recipes.title, likePattern(term))

	const inIngredients = (term: string) =>
		exists(
			database
				.select({ one: sql`1` })
				.from(recipeIngredients)
				.where(
					and(
						eq(recipeIngredients.recipeId, recipes.id),
						ilike(recipeIngredients.text, likePattern(term)),
					),
				),
		)

	const titleHits = sql.join(
		terms.map((term) => sql`(case when ${inTitle(term)} then 1 else 0 end)`),
		sql` + `,
	)

	const found = await recipesForUser(database, userId)
		.where(
			and(
				visibleTo(userId),
				...terms.map((term) => or(inTitle(term), inIngredients(term))),
			),
		)
		.orderBy(
			desc(titleHits),
			sql`${shelfRecipes.addedAt} is null`,
			desc(recipes.createdAt),
		)
		.limit(limit)

	if (found.length === 0) return []

	const lines = await database
		.select({
			recipeId: recipeIngredients.recipeId,
			text: recipeIngredients.text,
		})
		.from(recipeIngredients)
		.where(
			inArray(
				recipeIngredients.recipeId,
				found.map((recipe) => recipe.id),
			),
		)

	return found.map((recipe) => {
		const title = recipe.title.toLowerCase()

		const ingredients = lines
			.filter((line) => line.recipeId === recipe.id)
			.map((line) => line.text.toLowerCase())

		return {
			...recipe,
			saved: recipe.savedAt !== null,
			owned: recipe.userId === userId,
			ingredientMatches: terms.filter(
				(term) =>
					!title.includes(term) &&
					ingredients.some((line) => line.includes(term)),
			),
		}
	})
}

// Shared recipes worth a look, most saved and most cooked lately first, leaving
// out what this user already keeps.
export async function popularSharedRecipes(
	userId: string,
	limit = 12,
	database: Database = getDb(),
) {
	const saves = database
		.select({ recipeId: shelfRecipes.recipeId, saves: count().as('saves') })
		.from(shelfRecipes)
		.groupBy(shelfRecipes.recipeId)
		.as('saves')

	const cooks = database
		.select({ recipeId: mealLogs.recipeId, cooks: count().as('cooks') })
		.from(mealLogs)
		.where(gt(mealLogs.cookedAt, sql`now() - interval '30 days'`))
		.groupBy(mealLogs.recipeId)
		.as('cooks')

	const score = sql<number>`coalesce(${saves.saves}, 0) + coalesce(${cooks.cooks}, 0)`

	return database
		.select({
			id: recipes.id,
			title: recipes.title,
			imageUrl: recipes.imageUrl,
			sourceUrl: recipes.sourceUrl,
		})
		.from(recipes)
		.leftJoin(saves, eq(saves.recipeId, recipes.id))
		.leftJoin(cooks, eq(cooks.recipeId, recipes.id))
		.leftJoin(
			shelfRecipes,
			and(
				eq(shelfRecipes.recipeId, recipes.id),
				eq(shelfRecipes.userId, userId),
			),
		)
		.where(and(isNull(recipes.userId), isNull(shelfRecipes.id)))
		.orderBy(desc(score), desc(recipes.createdAt))
		.limit(limit)
}

async function assertOwnedCollection(
	database: RecipeDatabase,
	userId: string,
	id: string,
) {
	const [owned] = await database
		.select({ id: collections.id })
		.from(collections)
		.where(and(eq(collections.id, id), eq(collections.userId, userId)))

	if (!owned) throw new Error('collection not found')
}

export async function listCollectionsForUser(
	userId: string,
	database: Database = getDb(),
) {
	return database
		.select()
		.from(collections)
		.where(eq(collections.userId, userId))
		.orderBy(asc(collections.position), asc(collections.createdAt))
}

export async function renameCollectionForUser(
	userId: string,
	id: string,
	name: string,
	database: Database = getDb(),
) {
	const [collection] = await database
		.update(collections)
		.set({ name })
		.where(and(eq(collections.id, id), eq(collections.userId, userId)))
		.returning()

	return collection ?? null
}

export async function deleteCollectionForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	const [collection] = await database
		.delete(collections)
		.where(and(eq(collections.id, id), eq(collections.userId, userId)))
		.returning({ id: collections.id })

	return collection ?? null
}

export async function createCollectionForUser(
	userId: string,
	name: string,
	database: Database = getDb(),
) {
	const [row] = await database
		.select({ value: max(collections.position) })
		.from(collections)
		.where(eq(collections.userId, userId))

	const [collection] = await database
		.insert(collections)
		.values({
			id: crypto.randomUUID(),
			userId,
			name,
			position: (row?.value ?? -1) + 1,
			createdAt: new Date(),
		})
		.returning()

	return collection
}

async function assertVisibleRecipe(
	database: RecipeDatabase,
	userId: string,
	id: string,
) {
	const [recipe] = await database
		.select()
		.from(recipes)
		.where(and(eq(recipes.id, id), visibleTo(userId)))

	return recipe ?? null
}

// Puts a recipe on the shelf; saving one already there changes nothing.
export async function saveRecipeForUser(
	userId: string,
	recipeId: string,
	database: RecipeDatabase = getDb(),
) {
	const recipe = await assertVisibleRecipe(database, userId, recipeId)

	if (!recipe) return null

	await database
		.insert(shelfRecipes)
		.values({
			id: crypto.randomUUID(),
			userId,
			recipeId,
			addedAt: new Date(),
		})
		.onConflictDoNothing({
			target: [shelfRecipes.userId, shelfRecipes.recipeId],
		})

	return recipe
}

export async function moveRecipeForUser(
	userId: string,
	id: string,
	collectionId: string | null,
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		if (collectionId) await assertOwnedCollection(tx, userId, collectionId)

		const [shelved] = await tx
			.update(shelfRecipes)
			.set({ collectionId })
			.where(
				and(eq(shelfRecipes.recipeId, id), eq(shelfRecipes.userId, userId)),
			)
			.returning()

		return shelved ?? null
	})
}

// Imports keep a public URL; uploads must sit under the owner's prefix.
function assertRecipePhoto(
	userId: string,
	imageUrl: string | null | undefined,
) {
	if (
		imageUrl &&
		!/^https?:\/\//.test(imageUrl) &&
		!ownsRecipePhoto(userId, imageUrl)
	) {
		throw new Error('Invalid recipe photo')
	}
}

export async function createRecipeForUser(
	userId: string,
	input: {
		title: string
		imageUrl?: string | undefined
		sourceUrl?: string | undefined
		collectionId?: string | undefined
		notes?: string | undefined
		ingredients?: string[] | undefined
		steps?: string[] | undefined
		// Written recipes pass false and stay drafts until they are finished.
		finalized?: boolean | undefined
	},
	database: Database = getDb(),
) {
	assertRecipePhoto(userId, input.imageUrl)

	return database.transaction(async (tx) => {
		if (input.collectionId) {
			await assertOwnedCollection(tx, userId, input.collectionId)
		}

		const [recipe] = await tx
			.insert(recipes)
			.values({
				id: crypto.randomUUID(),
				userId,
				title: input.title,
				imageUrl: input.imageUrl ?? null,
				sourceUrl: input.sourceUrl ?? null,
				createdAt: new Date(),
				finalizedAt: input.finalized === false ? null : new Date(),
			})
			.returning()

		if (!recipe) return recipe
		await insertRecipeContent(tx, recipe.id, input.ingredients, input.steps)
		await tx.insert(shelfRecipes).values({
			id: crypto.randomUUID(),
			userId,
			recipeId: recipe.id,
			collectionId: input.collectionId ?? null,
			notes: input.notes ?? null,
			addedAt: recipe.createdAt,
		})

		return recipe
	})
}

export async function findSharedRecipeByUrl(
	sourceUrl: string,
	database: Database = getDb(),
) {
	const [recipe] = await database
		.select()
		.from(recipes)
		.where(and(isNull(recipes.userId), eq(recipes.sourceUrl, sourceUrl)))

	return recipe ?? null
}

// Adds a recipe from the web for everyone, once per page. Two people importing
// the same page at once both get the one row.
export async function createSharedRecipe(
	input: {
		title: string
		imageUrl?: string | undefined
		sourceUrl: string
		ingredients?: string[] | undefined
		steps?: string[] | undefined
	},
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		const now = new Date()

		const [recipe] = await tx
			.insert(recipes)
			.values({
				id: crypto.randomUUID(),
				userId: null,
				title: input.title,
				imageUrl: input.imageUrl ?? null,
				sourceUrl: input.sourceUrl,
				createdAt: now,
				finalizedAt: now,
			})
			.onConflictDoNothing({
				target: recipes.sourceUrl,
				where: isNull(recipes.userId),
			})
			.returning()

		if (!recipe) {
			const [existing] = await tx
				.select()
				.from(recipes)
				.where(
					and(isNull(recipes.userId), eq(recipes.sourceUrl, input.sourceUrl)),
				)

			return existing ?? null
		}

		await insertRecipeContent(tx, recipe.id, input.ingredients, input.steps)

		return recipe
	})
}

function contentLines(lines: string[] | undefined) {
	return (lines ?? []).map((line) => line.trim()).filter(Boolean)
}

async function insertRecipeContent(
	database: RecipeDatabase,
	recipeId: string,
	ingredientLines: string[] | undefined,
	stepLines: string[] | undefined,
) {
	const ingredients = contentLines(ingredientLines)
	const steps = contentLines(stepLines)

	if (ingredients.length) {
		await database.insert(recipeIngredients).values(
			ingredients.map((text, position) => ({
				id: crypto.randomUUID(),
				recipeId,
				position,
				text,
			})),
		)
	}

	if (steps.length) {
		await database.insert(recipeSteps).values(
			steps.map((text, position) => ({
				id: crypto.randomUUID(),
				recipeId,
				position,
				text,
			})),
		)
	}
}

function sameLines(a: string[], b: string[]) {
	return a.length === b.length && a.every((line, index) => line === b[index])
}

// Edits land on the user's own recipe. A shared recipe is never changed: the
// first real edit copies it for them, and their shelf row and cooks move to the
// copy. Notes are theirs either way and never copy anything.
export async function updateRecipeForUser(
	userId: string,
	{ id, ingredients, steps, finalize, notes, ...details }: RecipeUpdate,
	database: Database = getDb(),
) {
	assertRecipePhoto(userId, details.imageUrl)

	return database.transaction(async (tx) => {
		const current = await assertVisibleRecipe(tx, userId, id)

		if (!current) return null

		let recipe = current

		if (current.userId === userId) {
			const [updated] = await tx
				.update(recipes)
				.set(finalize ? { ...details, finalizedAt: new Date() } : details)
				.where(eq(recipes.id, id))
				.returning()

			if (!updated) return null
			recipe = updated
			await tx
				.delete(recipeIngredients)
				.where(eq(recipeIngredients.recipeId, id))
			await tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, id))
			await insertRecipeContent(tx, id, ingredients, steps)
		} else {
			const content = await recipeContent(tx, id)

			const changed =
				details.title !== current.title ||
				(details.imageUrl !== undefined &&
					details.imageUrl !== current.imageUrl) ||
				!sameLines(contentLines(ingredients), content.ingredients) ||
				!sameLines(contentLines(steps), content.steps)

			if (changed) {
				const [copy] = await tx
					.insert(recipes)
					.values({
						id: crypto.randomUUID(),
						userId,
						forkedFromId: current.id,
						title: details.title,
						imageUrl:
							details.imageUrl === undefined
								? current.imageUrl
								: details.imageUrl,
						sourceUrl: current.sourceUrl,
						servings: current.servings,
						totalMinutes: current.totalMinutes,
						createdAt: new Date(),
						finalizedAt: new Date(),
					})
					.returning()

				if (!copy) return null
				recipe = copy
				await insertRecipeContent(tx, copy.id, ingredients, steps)
				await saveRecipeForUser(userId, current.id, tx)
				await tx
					.update(shelfRecipes)
					.set({ recipeId: copy.id })
					.where(
						and(
							eq(shelfRecipes.userId, userId),
							eq(shelfRecipes.recipeId, current.id),
						),
					)
				await tx
					.update(mealLogs)
					.set({ recipeId: copy.id })
					.where(
						and(eq(mealLogs.userId, userId), eq(mealLogs.recipeId, current.id)),
					)
			}
		}

		await saveRecipeForUser(userId, recipe.id, tx)
		await tx
			.update(shelfRecipes)
			.set({ notes })
			.where(
				and(
					eq(shelfRecipes.userId, userId),
					eq(shelfRecipes.recipeId, recipe.id),
				),
			)

		return recipe
	})
}

// Takes a recipe off the shelf. A recipe the user wrote goes with it; a shared
// one stays for everyone else.
export async function deleteRecipeForUser(
	userId: string,
	id: string,
	database: Database = getDb(),
) {
	return database.transaction(async (tx) => {
		const [owned] = await tx
			.delete(recipes)
			.where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
			.returning({ id: recipes.id })

		if (owned) return owned

		const [shelved] = await tx
			.delete(shelfRecipes)
			.where(
				and(eq(shelfRecipes.recipeId, id), eq(shelfRecipes.userId, userId)),
			)
			.returning({ id: shelfRecipes.recipeId })

		return shelved ?? null
	})
}
