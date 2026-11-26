import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import { type Database, getDb, type Queryable } from '@/db/connection'
import { cookPlans, pantryItems, recipes } from '@/db/schema'
import {
	getRecipeForUser,
	ingredientLinesFor,
	visibleTo,
} from '@/lib/recipes/repository'

import {
	cookPlanInput,
	type CookPlanInput,
	finishCookInput,
	type FinishCookInput,
	unfinishCookInput,
	type UnfinishCookInput,
} from './schema'

const planOf = (userId: string, recipeId: string) =>
	and(eq(cookPlans.userId, userId), eq(cookPlans.recipeId, recipeId))

// What's skipped for a recipe in progress, or null when it isn't.
export async function getPlanForUser(
	userId: string,
	recipeId: string,
	database: Database = getDb(),
) {
	const [plan] = await database
		.select({ skipped: cookPlans.skipped, plannedAt: cookPlans.plannedAt })
		.from(cookPlans)
		.where(planOf(userId, recipeId))

	return plan ?? null
}

// The recipes in progress, newest first, each with what's skipped for it.
export async function plansForUser(
	userId: string,
	database: Database = getDb(),
) {
	return database
		.select({ recipeId: cookPlans.recipeId, skipped: cookPlans.skipped })
		.from(cookPlans)
		.innerJoin(recipes, eq(recipes.id, cookPlans.recipeId))
		.where(and(eq(cookPlans.userId, userId), visibleTo(userId, database)))
		.orderBy(desc(cookPlans.plannedAt))
}

// The recipes in progress, newest first: for home to know before its list
// loads, and the shelf to put them first.
export async function planIdsForUser(
	userId: string,
	database: Database = getDb(),
) {
	const plans = await plansForUser(userId, database)

	return plans.map((plan) => plan.recipeId)
}

// Everything in progress, newest first, each with the recipe as the cook
// can still read it: one since taken away is left off.
export async function listInProgressForUser(
	userId: string,
	database: Database = getDb(),
) {
	const plans = await database
		.select({
			recipeId: cookPlans.recipeId,
			skipped: cookPlans.skipped,
			plannedAt: cookPlans.plannedAt,
			title: recipes.title,
			imageUrl: recipes.imageUrl,
		})
		.from(cookPlans)
		.innerJoin(recipes, eq(recipes.id, cookPlans.recipeId))
		.where(and(eq(cookPlans.userId, userId), visibleTo(userId, database)))
		.orderBy(desc(cookPlans.plannedAt))

	const lines = await ingredientLinesFor(
		plans.map((plan) => plan.recipeId),
		database,
	)

	return plans.map((plan) => ({
		...plan,
		ingredients: lines.get(plan.recipeId) ?? [],
	}))
}

// In progress, or back in progress as it was.
async function putInProgress(
	query: Queryable,
	userId: string,
	plan: { recipeId: string; skipped: string[]; plannedAt: Date },
) {
	const [stored] = await query
		.insert(cookPlans)
		.values({ userId, ...plan })
		.onConflictDoUpdate({
			target: [cookPlans.userId, cookPlans.recipeId],
			set: { skipped: plan.skipped, plannedAt: plan.plannedAt },
		})
		.returning({ skipped: cookPlans.skipped, plannedAt: cookPlans.plannedAt })

	return stored ?? null
}

// In progress, with what's skipped for it now. Saved again, it's fresh again:
// the cook still means to make it.
export async function planCookForUser(
	userId: string,
	input: CookPlanInput,
	database: Database = getDb(),
) {
	const data = cookPlanInput.parse(input)

	if (!(await getRecipeForUser(userId, data.recipeId, database)))
		throw new Error('Recipe not found')

	return putInProgress(database, userId, {
		recipeId: data.recipeId,
		skipped: data.skipped,
		plannedAt: data.plannedAt ?? new Date(),
	})
}

// Not in progress any more, without cooking it: what was skipped goes with it.
export async function dropPlanForUser(
	userId: string,
	recipeId: string,
	database: Database = getDb(),
) {
	const [plan] = await database
		.delete(cookPlans)
		.where(planOf(userId, recipeId))
		.returning({ skipped: cookPlans.skipped, plannedAt: cookPlans.plannedAt })

	return plan ?? null
}

// Cooked: off what's in progress, and the fresh food it used up marked out. Hands back how things stood, to take it back.
export async function finishCookForUser(
	userId: string,
	input: FinishCookInput,
	database: Database = getDb(),
) {
	const data = finishCookInput.parse(input)

	// When this cook marked its food out: undo only touches food still as
	// it left it.
	const finishedAt = new Date()

	return database.transaction(async (tx) => {
		const [plan] = await tx
			.delete(cookPlans)
			.where(planOf(userId, data.recipeId))
			.returning({
				skipped: cookPlans.skipped,
				plannedAt: cookPlans.plannedAt,
			})

		const mine = and(
			eq(pantryItems.userId, userId),
			inArray(pantryItems.id, data.usedUp),
		)

		const items = data.usedUp.length
			? await tx
					.select({
						id: pantryItems.id,
						level: pantryItems.level,
						quantity: pantryItems.quantity,
						confirmedAt: pantryItems.confirmedAt,
						boughtAt: pantryItems.boughtAt,
					})
					.from(pantryItems)
					.where(mine)
					// Locked, in one order, so two cooks finishing at once over the
					// same food take turns: each reads what the other left.
					.orderBy(asc(pantryItems.id))
					.for('update')
			: []

		// Out, as "i'm out" says it: a count kept goes to none.
		for (const item of items)
			await tx
				.update(pantryItems)
				.set({
					level: 'out',
					quantity: item.quantity === null ? null : 0,
					confirmedAt: finishedAt,
				})
				.where(and(eq(pantryItems.id, item.id), eq(pantryItems.userId, userId)))

		return { plan: plan ?? null, items, finishedAt }
	})
}

// Not cooked after all: back in progress as it was, and the food home again as
// it stood.
export async function unfinishCookForUser(
	userId: string,
	input: UnfinishCookInput,
	database: Database = getDb(),
) {
	const data = unfinishCookInput.parse(input)
	const plan = data.plan

	if (plan && !(await getRecipeForUser(userId, data.recipeId, database)))
		throw new Error('Recipe not found')

	await database.transaction(async (tx) => {
		// Saved again since, the newer plan stands.
		if (plan)
			await tx
				.insert(cookPlans)
				.values({
					userId,
					recipeId: data.recipeId,
					skipped: plan.skipped,
					plannedAt: plan.plannedAt ?? new Date(),
				})
				.onConflictDoNothing()

		// Only what finishing changed, and only on food no one has touched
		// since: restocked, or used up by a later cook, keeps the newer word.
		for (const item of data.items)
			await tx
				.update(pantryItems)
				.set({
					level: item.level,
					quantity: item.quantity,
					confirmedAt: item.confirmedAt,
				})
				.where(
					and(
						eq(pantryItems.id, item.id),
						eq(pantryItems.userId, userId),
						eq(pantryItems.confirmedAt, data.finishedAt),
					),
				)
	})
}
