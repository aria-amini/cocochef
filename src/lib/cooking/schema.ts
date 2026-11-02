import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { cookingProgress } from '@/db/schema'

export const cookingId = createSelectSchema(cookingProgress).pick({
	recipeId: true,
})

export const cookingCommand = cookingId
	.extend({
		action: z.enum(['start', 'pause', 'finish', 'check']),
		item: z
			.string()
			.regex(/^[is]\d+$/)
			.optional(),
		done: z.boolean().optional(),
	})
	.refine(
		(value) =>
			value.action !== 'check' ||
			(value.item !== undefined && value.done !== undefined),
		'A check needs an item and its state',
	)

export type CookingCommand = z.infer<typeof cookingCommand>
