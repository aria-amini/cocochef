import {
	boolean,
	foreignKey,
	primaryKey,
	snakeCase,
	text,
	timestamp,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { recipes } from './recipes'

export const cookingProgress = snakeCase.table(
	'cooking_progress',
	{
		userId: text().notNull(),
		recipeId: text().notNull(),
		active: boolean().notNull(),
		checked: text().array().notNull(),
		content: text().notNull(),
		startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.recipeId] }),
		foreignKey({ columns: [table.userId], foreignColumns: [user.id] }).onDelete(
			'cascade',
		),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
		}).onDelete('cascade'),
	],
)
