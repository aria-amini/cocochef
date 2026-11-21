import { z } from 'zod'

import { pantryBrand } from '@/lib/pantry/model'

const groceryBulkMax = 100

export const groceryFields = {
	// Set by a list that shows the item before the server has it, so a tick
	// or rename right after adding reaches the same row.
	id: z.uuid().optional(),
	text: z.string().trim().min(1).max(200),
	// The recipes asking for it, so the list can say what each is for.
	recipeIds: z.array(z.string().min(1)).max(20).optional(),
	// Left out, the line takes the brand of the pantry item for its food.
	brand: pantryBrand.nullish(),
}

const groceryInput = z.object(groceryFields)

export type GroceryInput = z.infer<typeof groceryInput>

// Two lines name the same item when they read the same, case aside.
export const sameItem = (text: string) => text.trim().toLowerCase()

export const groceryInputs = z.array(groceryInput).min(1).max(groceryBulkMax)
