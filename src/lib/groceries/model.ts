import { z } from 'zod'

const groceryBulkMax = 100

export const groceryFields = {
	// Set by a list that shows the item before the server has it, so a tick
	// or rename right after adding reaches the same row.
	id: z.uuid().optional(),
	text: z.string().trim().min(1).max(200),
	recipeId: z.string().min(1).optional(),
	recipeTitle: z.string().trim().min(1).max(500).optional(),
}

const groceryInput = z.object(groceryFields)

export type GroceryInput = z.infer<typeof groceryInput>

export const groceryInputs = z.array(groceryInput).min(1).max(groceryBulkMax)
