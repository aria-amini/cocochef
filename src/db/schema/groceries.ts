import {
	foreignKey,
	index,
	jsonb,
	snakeCase,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'

import { pantryCategories, type PantryLevel } from '@/lib/pantry/model'

import { user } from './auth'
import { pantryItems } from './pantry'
import { recipes } from './recipes'

// One line of a cook's grocery list: what to buy, the aisle it is shelved
// under, the recipe that asked for it, and when it went in the cart.
// Into the cart is into the kitchen: the tick tops up the pantry item for its
// food or makes one, and keeps what that item was so an untick puts it back.
// A pantry item as it stood before a tick filled it, dates as ISO strings.
export type StockedWas = {
	level: PantryLevel
	quantity: number | null
	confirmedAt: string
	boughtAt: string
}

export const groceryItems = snakeCase.table(
	'grocery_items',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		text: text().notNull(),
		category: text({ enum: pantryCategories }).notNull(),
		// The recipe it came from, and its name as the cook saw it then.
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
