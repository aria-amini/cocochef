import { boolean, snakeCase, text, timestamp } from 'drizzle-orm/pg-core'

// The parts of a meal a classifier read from a recipe: its cuisine, flavor,
// protein and kind of dish, from the lists in meal-parts.ts. Keyed by the
// recipe's page, so a catalog page and the shared recipe read from it share
// one row; a recipe with no page is keyed `recipe:<id>`.
export const mealTags = snakeCase.table('meal_tags', {
	key: text().primaryKey(),
	// False for desserts, drinks, sauces and the like, which offer no parts.
	meal: boolean().notNull(),
	cuisines: text().array().notNull().default([]),
	flavors: text().array().notNull().default([]),
	proteins: text().array().notNull().default([]),
	forms: text().array().notNull().default([]),
	// The classifier and version that answered, so a better one can redo them.
	model: text().notNull(),
	taggedAt: timestamp({ withTimezone: true }).notNull(),
})
