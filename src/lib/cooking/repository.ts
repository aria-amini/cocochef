import { and, eq } from 'drizzle-orm'

import { type Database, getDb } from '@/db/connection'
import { cookingProgress, recipes } from '@/db/schema'
import { ingredientHeading } from '@/lib/recipes/ingredient-line'
import { getRecipeForUser } from '@/lib/recipes/repository'

import { cookingCommand, type CookingCommand } from './schema'

export async function getCookingForUser(
	userId: string,
	recipeId: string,
	database: Database = getDb(),
) {
	const recipe = await getRecipeForUser(userId, recipeId, database)

	if (!recipe) return null

	const [progress] = await database
		.select()
		.from(cookingProgress)
		.where(
			and(
				eq(cookingProgress.userId, userId),
				eq(cookingProgress.recipeId, recipeId),
			),
		)

	if (
		!progress ||
		progress.content !== JSON.stringify([recipe.ingredients, recipe.steps])
	)
		return null

	return progress
}

export async function updateCookingForUser(
	userId: string,
	input: CookingCommand,
	database: Database = getDb(),
) {
	const data = cookingCommand.parse(input)
	const recipe = await getRecipeForUser(userId, data.recipeId, database)

	if (!recipe) throw new Error('Recipe not found')
	const content = JSON.stringify([recipe.ingredients, recipe.steps])

	const where = and(
		eq(cookingProgress.userId, userId),
		eq(cookingProgress.recipeId, data.recipeId),
	)

	return database.transaction(async (tx) => {
		// Upsert first serializes commands for this user and recipe, including a
		// simultaneous first start from two devices.
		await tx
			.insert(cookingProgress)
			.values({
				userId,
				recipeId: data.recipeId,
				active: false,
				checked: [],
				content,
				updatedAt: new Date(),
			})
			.onConflictDoNothing()

		const [stored] = await tx
			.select()
			.from(cookingProgress)
			.where(where)
			.for('update')

		if (!stored) {
			if (data.action === 'finish') return null
			throw new Error('Cooking session not found')
		}

		if (data.action === 'finish') {
			await tx.delete(cookingProgress).where(where)

			return null
		}

		const checked = new Set(stored.content === content ? stored.checked : [])

		if (data.action === 'check') {
			if (!stored.active || stored.content !== content)
				throw new Error('Start cooking before checking items')
			const item = data.item!
			const index = Number(item.slice(1))

			const line =
				item[0] === 'i' ? recipe.ingredients[index] : recipe.steps[index]

			if (!line || (item[0] === 'i' && ingredientHeading(line) !== undefined))
				throw new Error('Cooking item not found')

			if (data.done) checked.add(item)
			else checked.delete(item)
		}

		const [progress] = await tx
			.update(cookingProgress)
			.set({
				active: data.action === 'pause' ? false : true,
				checked: [...checked],
				content,
				startedAt: stored.content === content ? stored.startedAt : new Date(),
				updatedAt: new Date(),
			})
			.where(where)
			.returning()

		return progress ?? null
	})
}

export async function listActiveCookingForUser(
	userId: string,
	database: Database = getDb(),
) {
	const sessions = await database
		.select({ recipeId: cookingProgress.recipeId, title: recipes.title })
		.from(cookingProgress)
		.innerJoin(recipes, eq(recipes.id, cookingProgress.recipeId))
		.where(
			and(eq(cookingProgress.userId, userId), eq(cookingProgress.active, true)),
		)

	return (
		await Promise.all(
			sessions.map(async (session) => {
				const progress = await getCookingForUser(
					userId,
					session.recipeId,
					database,
				)

				return progress
					? {
							...progress,
							title: session.title,
							steps:
								(await getRecipeForUser(userId, session.recipeId, database))
									?.steps.length ?? 0,
						}
					: null
			}),
		)
	).filter((session) => session !== null)
}
