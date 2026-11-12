import {
	foreignKey,
	index,
	snakeCase,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'

import { pantryCategories } from '@/lib/pantry/model'

import { user } from './auth'
import { recipes } from './recipes'

// One line of a cook's grocery list: what to buy, the aisle it is shelved
// under, the recipe that asked for it, and when it went in the cart.
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
	],
)
