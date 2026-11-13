import { z } from 'zod'

export const pantryCategories = [
	'spices',
	'meat',
	'dairy',
	'vegetables',
	'fruit',
	'grains',
	'cans',
	'sauces',
	'frozen',
	'other',
] as const

// How much of a food is left: enough, running low, or none. An item that
// runs out stays in the pantry, so it is easy to buy again.
export const pantryLevels = ['plenty', 'low', 'out'] as const

export type PantryLevel = (typeof pantryLevels)[number]

export const pantryLevelLabels: Record<PantryLevel, string> = {
	plenty: 'enough',
	low: 'running low',
	out: 'out',
}

export const pantryQuantityMax = 9999

export const pantryBulkMax = 100

export const pantryCount = z.number().int().min(0).max(pantryQuantityMax)

export const pantryFields = {
	name: z.string().trim().min(1).max(80),
	level: z.enum(pantryLevels).optional(),
	quantity: pantryCount.nullish(),
	category: z.enum(pantryCategories),
	spriteKey: z.string().trim().min(1).max(60).optional(),
}

export const pantryItemInput = z.object(pantryFields)

export type PantryItemInput = z.infer<typeof pantryItemInput>

export type PantryCategory = PantryItemInput['category']

export const pantryCategoryLabels: Record<PantryCategory, string> = {
	spices: 'spices',
	meat: 'meat & seafood',
	dairy: 'dairy & eggs',
	vegetables: 'vegetables & herbs',
	fruit: 'fruit',
	grains: 'grains & baking',
	cans: 'cans & dry goods',
	sauces: 'oils & sauces',
	frozen: 'frozen',
	other: 'other',
}
