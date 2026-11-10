import { z } from 'zod'

const groceryBulkMax = 100

export const groceryFields = {
	text: z.string().trim().min(1).max(200),
	recipeId: z.string().min(1).optional(),
	recipeTitle: z.string().trim().min(1).max(500).optional(),
}

const groceryInput = z.object(groceryFields)

export type GroceryInput = z.infer<typeof groceryInput>

export const groceryInputs = z.array(groceryInput).min(1).max(groceryBulkMax)
