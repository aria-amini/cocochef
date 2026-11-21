import {
	boolean,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	snakeCase,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'

import { pantryCategories, type PantryLevel } from '@/lib/pantry/model'

import { user } from './auth'
import { pantryItems } from './pantry'
import { recipes } from './recipes'

// One line of a cook's grocery list: what to buy, the aisle it is shelved
// under, and when it went in the cart. The recipes that asked for it are
// kept beside it, in `groceryItemRecipes`.
// Into the cart is into the kitchen: the tick tops up the pantry item for its
// food or makes one, and keeps what that item was so an untick puts it back.
// A pantry item as it stood before a tick filled it, dates as ISO strings.
export type StockedWas = {
	level: PantryLevel
	quantity: number | null
	confirmedAt: string
	boughtAt: string
	// Absent on lines remembered before brands were kept.
	brand?: string | null | undefined
}

export const groceryItems = snakeCase.table(
	'grocery_items',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		text: text().notNull(),
		category: text({ enum: pantryCategories }).notNull(),
		// The brand to buy, if the cook has one: taken from the pantry item for
		// the food when the line is added, and given back to it when put away.
		brand: text(),
		// Retired: the recipes a line is for live in `groceryItemRecipes` now.
		// Kept, unread and unwritten, so the build before it still runs while a
		// deploy swaps over; a later migration drops them.
		recipeId: text(),
		recipeTitle: text(),
		checkedAt: timestamp({ withTimezone: true }),
		// The pantry item the tick filled, and how it stood before: null when
		// the tick made it, so an untick takes it away again.
		stockedId: text(),
		stockedWas: jsonb().$type<StockedWas>(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		index('grocery_items_user_id_index').on(table.userId),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'grocery_items_user_id_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'grocery_items_recipe_id_fk',
		}).onDelete('set null'),
		foreignKey({
			columns: [table.stockedId],
			foreignColumns: [pantryItems.id],
			name: 'grocery_items_stocked_id_fk',
		}).onDelete('set null'),
	],
)

// The recipes a line is for: one food can be wanted by several, and it stays
// on the list for as long as any of them does. A recipe that goes takes its
// mark with it, so a mark never points at nothing.
export const groceryItemRecipes = snakeCase.table(
	'grocery_item_recipes',
	{
		itemId: text().notNull(),
		recipeId: text().notNull(),
		// Whether the line was made for this recipe, rather than one already
		// there (typed by hand, or another recipe's) that it was added to. A
		// recipe let go of takes only the lines it made.
		made: boolean().notNull().default(false),
	},
	(table) => [
		primaryKey({ columns: [table.itemId, table.recipeId] }),
		index('grocery_item_recipes_recipe_id_index').on(table.recipeId),
		foreignKey({
			columns: [table.itemId],
			foreignColumns: [groceryItems.id],
			name: 'grocery_item_recipes_item_id_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'grocery_item_recipes_recipe_id_fk',
		}).onDelete('cascade'),
	],
)
