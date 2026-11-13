import {
	foreignKey,
	index,
	integer,
	snakeCase,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'

import { pantryCategories, pantryLevels } from '@/lib/pantry/model'

import { user } from './auth'

export const pantryItems = snakeCase.table(
	'pantry_items',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		name: text().notNull(),
		// How much is left: a level for everything, and a count for the foods
		// counted one by one (eggs, cans) when the cook keeps one.
		level: text({ enum: pantryLevels }).notNull().default('plenty'),
		quantity: integer(),
		category: text({ enum: pantryCategories }).notNull(),
		spriteKey: text(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
		// When the cook last said how much is left: added it, set its level or
		// count, put it away, or said they have it. How long that holds depends
		// on the food (see foods.ts).
		confirmedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		// When it came into the kitchen: added, put away, or said to be had.
		// Fresh food spoils from here; a change of level does not move it.
		boughtAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('pantry_items_user_id_index').on(table.userId),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: 'pantry_items_user_id_fk',
		}).onDelete('cascade'),
	],
)
