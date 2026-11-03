import { getDb, type Database } from '@/db/connection'

import {
	createCollectionForUser,
	createRecipeForUser,
	getRecipeForUser,
	listCollectionsForUser,
	listShelfForUser,
} from './repository'
import {
	toTransferDocument,
	toTransferRecipe,
	type TransferRecipe,
} from './transfer'

// One recipe the user can see, or the whole shelf, in the transfer format.
export async function exportRecipesForUser(
	userId: string,
	recipeId?: string,
	database: Database = getDb(),
) {
	const [shelf, books] = await Promise.all([
		listShelfForUser(userId, database),
		listCollectionsForUser(userId, database),
	])

	const bookName = new Map(books.map((book) => [book.id, book.name]))
	const ids = recipeId ? [recipeId] : shelf.recipes.map((recipe) => recipe.id)
	const exported: TransferRecipe[] = []

	for (const id of ids) {
		const recipe = await getRecipeForUser(userId, id, database)

		if (!recipe) continue

		exported.push(
			toTransferRecipe({
				...recipe,
				book: recipe.collectionId
					? bookName.get(recipe.collectionId)
					: undefined,
			}),
		)
	}

	return toTransferDocument(exported)
}

function sameLines(a: string[], b: string[]) {
	return a.length === b.length && a.every((line, index) => line === b[index])
}

function trimmed(lines: string[] | undefined) {
	return (lines ?? []).map((line) => line.trim()).filter(Boolean)
}

// Recipes come in as the user's own, finished, and private: a draft in the file
// is a recipe on the shelf, not another draft to open and finish. One already
// on their shelf, saved or their own, with the same name and the same
// ingredients and steps is skipped, so a file can be brought in twice, or after
// a partly failed try, without doubling anything.
export async function importRecipesForUser(
	userId: string,
	recipes: TransferRecipe[],
	database: Database = getDb(),
) {
	const shelf = await listShelfForUser(userId, database)

	const books = new Map(
		(await listCollectionsForUser(userId, database)).map((book) => [
			book.name,
			book.id,
		]),
	)

	const known: { title: string; ingredients: string[]; steps: string[] }[] = []

	for (const { id } of shelf.recipes) {
		const recipe = await getRecipeForUser(userId, id, database)

		if (recipe) known.push(recipe)
	}

	let imported = 0
	let skipped = 0

	for (const recipe of recipes) {
		const ingredients = trimmed(recipe.ingredients)
		const steps = trimmed(recipe.steps)

		if (
			known.some(
				(have) =>
					have.title === recipe.title &&
					sameLines(have.ingredients, ingredients) &&
					sameLines(have.steps, steps),
			)
		) {
			skipped += 1
			continue
		}

		let collectionId = recipe.book ? books.get(recipe.book) : undefined

		if (recipe.book && !collectionId) {
			collectionId = (
				await createCollectionForUser(userId, recipe.book, database)
			)?.id

			if (collectionId) books.set(recipe.book, collectionId)
		}

		const created = await createRecipeForUser(
			userId,
			{
				title: recipe.title,
				imageUrl: recipe.imageUrl,
				sourceUrl: recipe.sourceUrl,
				sourceNotes: recipe.sourceNotes,
				notes: recipe.notes || undefined,
				collectionId,
				ingredients,
				ingredientCategories: recipe.ingredientCategories,
				steps,
				publish: false,
			},
			database,
		)

		if (created) {
			imported += 1
			known.push({ title: recipe.title, ingredients, steps })
		}
	}

	return { imported, skipped }
}
