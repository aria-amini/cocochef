import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { cookingProgress, cookPlans, pantryItems } from '@/db/schema'

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

const recipeLine = z.string().max(500)

// A recipe put in progress, with the foods skipped for it. Taken back, it keeps
// the day it went on.
export const cookPlanInput = createSelectSchema(cookPlans)
	.pick({ recipeId: true })
	.extend({
		skipped: z.array(recipeLine).max(200),
		plannedAt: z.coerce.date().optional(),
	})

// Cooked: the fresh food used up goes out, by its pantry item.
export const finishCookInput = cookingId.extend({
	usedUp: z.array(z.string().min(1)).max(200),
})

// How a pantry item stood before cooking used it up.
const usedUpItem = createSelectSchema(pantryItems).pick({
	id: true,
	level: true,
	quantity: true,
	confirmedAt: true,
	boughtAt: true,
})

// What cooking changed, to change it back: the plan as it was, and the
// food marked out.
export const unfinishCookInput = cookingId.extend({
	plan: cookPlanInput.omit({ recipeId: true }).nullable(),
	items: z
		.array(
			usedUpItem.extend({
				confirmedAt: z.coerce.date(),
				boughtAt: z.coerce.date(),
			}),
		)
		.max(200),
})

export type CookPlanInput = z.infer<typeof cookPlanInput>

export type FinishCookInput = z.infer<typeof finishCookInput>

export type UnfinishCookInput = z.infer<typeof unfinishCookInput>
