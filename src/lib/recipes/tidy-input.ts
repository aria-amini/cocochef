import { z } from 'zod'

import { recipeContentInput } from './model'

export const tidyInputMax = 20_000

// Either text copied from anywhere, or a recipe already in the editor.
export const tidyRecipeInput = z.union([
	z.object({ text: z.string().trim().min(1).max(tidyInputMax) }),
	recipeContentInput.pick({
		title: true,
		ingredients: true,
		steps: true,
		notes: true,
	}),
])

export type TidyRecipeInput = z.infer<typeof tidyRecipeInput>
