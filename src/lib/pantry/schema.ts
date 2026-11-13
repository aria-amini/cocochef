import { createInsertSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { pantryItems } from '@/db/schema'

import { pantryBulkMax, pantryFields } from './model'

export const insertPantryItem = createInsertSchema(
	pantryItems,
	pantryFields,
).pick({
	name: true,
	level: true,
	quantity: true,
	category: true,
	spriteKey: true,
})

export const insertPantryItems = z
	.array(insertPantryItem)
	.min(1)
	.max(pantryBulkMax)
