import {
	boolean,
	foreignKey,
	index,
	snakeCase,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
import { recipes } from './recipes'

export const sharingProfiles = snakeCase.table('sharing_profiles', {
	userId: text()
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	handle: text().notNull().unique(),
	displayName: text().notNull(),
	autoPublish: boolean().notNull().default(false),
})

// A deliberate publication, separate from saving a recipe or its personal notes.
export const recipeShares = snakeCase.table(
	'recipe_shares',
	{
		id: text().primaryKey(),
		userId: text().notNull(),
		recipeId: text().notNull(),
		slug: text().notNull(),
		visibility: text({ enum: ['private', 'unlisted', 'public'] })
			.notNull()
			.default('private'),
		token: text().notNull().unique(),
		createdAt: timestamp({ withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex('recipe_shares_user_recipe_index').on(
			table.userId,
			table.recipeId,
		),
		uniqueIndex('recipe_shares_user_slug_index').on(table.userId, table.slug),
		index('recipe_shares_recipe_index').on(table.recipeId),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [sharingProfiles.userId],
			name: 'recipe_shares_profile_fk',
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.recipeId],
			foreignColumns: [recipes.id],
			name: 'recipe_shares_recipe_fk',
		}).onDelete('cascade'),
	],
)

// Stable, credited addresses for shared web imports, created when first shared.
export const webRecipeLinks = snakeCase.table(
	'web_recipe_links',
	{
		recipeId: text()
			.primaryKey()
			.references(() => recipes.id, { onDelete: 'cascade' }),
		site: text().notNull(),
		slug: text().notNull(),
	},
	(table) => [
		uniqueIndex('web_recipe_links_site_slug_index').on(table.site, table.slug),
	],
)
