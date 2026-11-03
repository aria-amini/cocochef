import { z } from 'zod'

import { pantryCategories } from '@/lib/pantry/model'

import {
	clampRecipeTitle,
	recipeImageUrl,
	recipeInput,
	recipeNotesMax,
	recipeSourceNotes,
	type IngredientCategories,
} from './model'

// A file that carries recipes from one kitchen to another, such as a preview
// to production. It holds what a cook wrote or kept: the recipe, their notes
// and their book. It leaves out what belongs to one deployment: photos in its
// storage, cooking history, and sharing.
export const transferFormat = 'dutch-oven/recipes'

export const transferVersion = 1

export const transferRecipeMax = 500

const lines = z.array(z.string()).max(300)

const transferRecipe = recipeInput
	.pick({ title: true, sourceUrl: true, finalized: true })
	.extend({
		notes: z.string().trim().max(recipeNotesMax).optional(),
		sourceNotes: recipeSourceNotes.optional(),
		imageUrl: recipeImageUrl.optional(),
		book: z.string().trim().min(1).max(80).optional(),
		ingredients: lines.optional(),
		ingredientCategories: z
			.record(z.string(), z.enum(pantryCategories))
			.optional(),
		steps: lines.optional(),
	})

export type TransferRecipe = z.infer<typeof transferRecipe>

export type TransferDocument = {
	format: typeof transferFormat
	version: typeof transferVersion
	exportedAt: string
	recipes: TransferRecipe[]
}

// Photos a cook uploaded live in one deployment's storage, so only a link to a
// picture on the web travels.
function webImage(imageUrl: string | null) {
	return imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : undefined
}

export function toTransferRecipe(recipe: {
	title: string
	sourceUrl: string | null
	imageUrl: string | null
	notes: string | null
	sourceNotes?: string | null | undefined
	finalizedAt: Date | null
	ingredients: string[]
	ingredientCategories: IngredientCategories
	steps: string[]
	book?: string | undefined
}): TransferRecipe {
	const image = webImage(recipe.imageUrl)

	const transfer: TransferRecipe = {
		title: recipe.title,
		finalized: recipe.finalizedAt !== null,
		ingredients: recipe.ingredients,
		steps: recipe.steps,
	}

	if (recipe.sourceUrl) transfer.sourceUrl = recipe.sourceUrl

	if (image) transfer.imageUrl = image

	if (recipe.notes) transfer.notes = recipe.notes

	if (recipe.sourceNotes != null) transfer.sourceNotes = recipe.sourceNotes

	if (recipe.book) transfer.book = recipe.book

	const categories = Object.fromEntries(
		Object.entries(recipe.ingredientCategories).flatMap(([line, category]) =>
			category ? [[line, category] as const] : [],
		),
	)

	if (Object.keys(categories).length) transfer.ingredientCategories = categories

	return transfer
}

export function toTransferDocument(
	recipes: TransferRecipe[],
	exportedAt = new Date(),
): TransferDocument {
	return {
		format: transferFormat,
		version: transferVersion,
		exportedAt: exportedAt.toISOString(),
		recipes,
	}
}

const envelope = z.object({
	format: z.literal(transferFormat),
	version: z.number().int().min(1),
	recipes: z.array(z.unknown()),
})

export type ParsedTransfer =
	| { ok: true; recipes: TransferRecipe[] }
	| { ok: false; error: string }

// The file's text is accepted or refused with the first thing wrong in it, so a
// partly read file never half-fills a shelf.
export function parseTransferDocument(text: string): ParsedTransfer {
	let input: unknown = undefined

	try {
		input = JSON.parse(text)
	} catch {
		return { ok: false, error: "that file isn't JSON" }
	}

	const head = envelope.safeParse(input)

	if (!head.success)
		return { ok: false, error: "that isn't a dutch-oven recipe file" }

	if (head.data.version > transferVersion)
		return {
			ok: false,
			error: 'that file is from a newer dutch-oven — update this one first',
		}

	if (head.data.recipes.length > transferRecipeMax)
		return {
			ok: false,
			error: `a file can hold at most ${transferRecipeMax} recipes`,
		}

	const recipes: TransferRecipe[] = []

	for (const [index, raw] of head.data.recipes.entries()) {
		const parsed = transferRecipe.safeParse(raw)

		if (!parsed.success) {
			const issue = parsed.error.issues[0]
			const field = issue?.path.join('.') || 'recipe'

			return {
				ok: false,
				error: `recipe ${index + 1}: ${field} ${issue?.message ?? 'is not valid'}`,
			}
		}

		const { ingredientCategories, ...rest } = parsed.data

		const recipe: TransferRecipe = {
			...rest,
			title: clampRecipeTitle(rest.title),
		}

		// Lines are matched by their trimmed text, so hand-edited keys are too.
		if (ingredientCategories)
			recipe.ingredientCategories = Object.fromEntries(
				Object.entries(ingredientCategories).map(([line, category]) => [
					line.trim(),
					category,
				]),
			)

		recipes.push(recipe)
	}

	return { ok: true, recipes }
}

export function transferFilename(title?: string) {
	const slug = (title ?? '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60)

	return `${slug || 'dutch-oven-recipes'}.json`
}
