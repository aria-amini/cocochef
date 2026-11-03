import { z } from 'zod'

import { pantryCategories, type PantryCategory } from '@/lib/pantry/model'

export const recipeTitleMax = 120

export const recipeNotesMax = 2000

// Publisher notes are kept as imported, including line breaks and empty checked markers.
export const recipeSourceNotes = z.string()

// zod measures string length in code points, so truncate the same way to avoid splitting a surrogate pair
export const clampRecipeTitle = (title: string) =>
	Array.from(title.trim()).slice(0, recipeTitleMax).join('')

export const recipeImageUrl = z.url({ protocol: /^https?$/ }).max(500)

// Uploaded photos live in storage under the owner's prefix; imports keep a URL.
export const recipePhotoKey = (userId: string) =>
	`recipes/${userId}-${crypto.randomUUID()}`

export const ownsRecipePhoto = (userId: string, image: string) =>
	image.startsWith(`recipes/${userId}-`)

const recipePhotoPath = z.string().regex(/^recipes\/[\w-]{1,150}$/)

const recipeFields = {
	title: z.string().trim().min(1).max(recipeTitleMax),
	imageUrl: recipeImageUrl,
	sourceUrl: z.url({ protocol: /^https?$/ }).max(2000),
	notes: z.string().trim().max(recipeNotesMax),
}

const contentLines = z
	.array(z.string())
	.transform((lines) => lines.map((line) => line.trim()).filter(Boolean))

// The cook's own grouping for ingredients, keyed by the ingredient's line.
// Lines without an entry are grouped by guessing from the food.
export type IngredientCategories = Partial<Record<string, PantryCategory>>

const ingredientCategories = z
	.record(z.string(), z.enum(pantryCategories))
	.optional()

export const recipeInput = z.object({
	title: recipeFields.title,
	imageUrl: z.preprocess(
		(value) => (value === '' ? undefined : value),
		z.union([recipeFields.imageUrl, recipePhotoPath]).optional(),
	),
	sourceUrl: recipeFields.sourceUrl.optional(),
	collectionId: z.string().min(1).optional(),
	finalized: z.boolean().optional(),
	notes: recipeFields.notes.optional().transform((notes) => notes || undefined),
	ingredients: contentLines.optional(),
	ingredientCategories,
	steps: contentLines.optional(),
})

export const recipeUpdateInput = z.object({
	id: z.string().min(1),
	title: recipeFields.title,
	// Omitted keeps the current photo; null removes it.
	imageUrl: z.union([recipeFields.imageUrl, recipePhotoPath]).nullish(),
	// Omitted keeps the link to the original; null removes it, and with it the
	// link to the Dutch Oven recipe this one was copied from: the recipe is the
	// cook's own.
	sourceUrl: recipeFields.sourceUrl.nullish(),
	notes: recipeFields.notes.nullable().transform((notes) => notes || null),
	finalize: z.boolean().optional(),
	ingredients: contentLines,
	ingredientCategories,
	steps: contentLines,
})

export type RecipeUpdate = z.infer<typeof recipeUpdateInput>

// Everything the editor writes, before the recipe has an id.
export const recipeContentInput = recipeUpdateInput.omit({
	id: true,
	finalize: true,
})

export type RecipeContent = z.infer<typeof recipeContentInput>

export const recipeIdInput = z.object({ id: z.string().min(1) })

export function formatMinutes(minutes: number) {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60

	if (!hours) return `${rest} min`

	return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

export const bookNameMax = 40

export const bookName = z.string().trim().min(1).max(bookNameMax)

export const bookInput = z.object({ name: bookName })

export const bookIdInput = z.object({ id: z.string().min(1) })

export const bookRenameInput = z.object({
	id: z.string().min(1),
	name: bookName,
})

export const recipeMoveInput = z.object({
	id: z.string().min(1),
	collectionId: z.string().min(1).nullable(),
})

export function matchesRecipeQuery(title: string, query: string | undefined) {
	return !query || title.toLocaleLowerCase().includes(query.toLocaleLowerCase())
}
