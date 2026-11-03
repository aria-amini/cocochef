import { isNull } from 'drizzle-orm'
import {
	foreignKey,
	index,
	integer,
	snakeCase,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core'

import { pantryCategories } from '@/lib/pantry/model'

import { user } from './auth'

// `raw` is the display truth — quantity/unit/name/note are populated later by
// heuristic parsing, are parse-time only, and are currently not persisted.
export type RecipeIngredient = {
	raw: string
	quantity?: number | null
	unit?: string | null
	name?: string | null
	note?: string | null
}

export const collections = snakeCase.table(
	'collections',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		name: text().notNull(),
		position: integer().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		index('collections_user_id_index').on(table.userId),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'collections_user_id_fk',
		}).onDelete('cascade'),
	],
)

// One recipe, shared by everyone who saves it. A recipe from the web has no
// owner and one row per page; a recipe someone writes, or a copy they edit, is
// theirs alone. Who saved what, and in which book, lives in `shelfRecipes`.
export const recipes = snakeCase.table(
	'recipes',
	{
		id: text().primaryKey(),
		// The writer; null for a shared recipe from the web.
		userId: text(),
		// The recipe this one was copied from to be edited.
		forkedFromId: text(),
		title: text().notNull(),
		imageUrl: text(),
		sourceUrl: text(),
		// Publisher's recipe-card notes, separate from each cook's private notes.
		sourceNotes: text(),
		servings: integer(),
		totalMinutes: integer(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
		// Null while a written recipe is still a draft.
		finalizedAt: timestamp({ withTimezone: true }),
	},
	(table) => [
		index('recipes_user_id_index').on(table.userId),
		uniqueIndex('recipes_shared_source_url_index')
			.on(table.sourceUrl)
			.where(isNull(table.userId)),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'recipes_user_id_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.forkedFromId],
			foreignColumns: [table.id],
			name: 'recipes_forked_from_id_fk',
		}).onDelete('set null'),
	],
)

// A recipe on someone's shelf, with what is theirs about it: its book and their
// notes. Cooking counts come from meal logs.
export const shelfRecipes = snakeCase.table(
	'shelf_recipes',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		recipeId: text().notNull(),
		collectionId: text(),
		notes: text(),
		addedAt: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex('shelf_recipes_user_recipe_index').on(
			table.userId,
			table.recipeId,
		),
		index('shelf_recipes_recipe_id_index').on(table.recipeId),
		index('shelf_recipes_collection_id_index').on(table.collectionId),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'shelf_recipes_user_id_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'shelf_recipes_recipe_id_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.collectionId],
			foreignColumns: [collections.id],
			name: 'shelf_recipes_collection_id_fk',
		}).onDelete('set null'),
	],
)

export const recipeIngredients = snakeCase.table(
	'recipe_ingredients',
	{
		id: text().primaryKey(),
		recipeId: text().notNull(),
		position: integer().notNull(),
		text: text().notNull(),
		// The cook's own grouping; null leaves the guess from the line's food.
		category: text({ enum: pantryCategories }),
	},
	(table) => [
		index('recipe_ingredients_recipe_id_index').on(table.recipeId),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'recipe_ingredients_recipe_id_fk',
		}).onDelete('cascade'),
	],
)

export const recipeSteps = snakeCase.table(
	'recipe_steps',
	{
		id: text().primaryKey(),
		recipeId: text().notNull(),
		position: integer().notNull(),
		text: text().notNull(),
	},
	(table) => [
		index('recipe_steps_recipe_id_index').on(table.recipeId),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'recipe_steps_recipe_id_fk',
		}).onDelete('cascade'),
	],
)
