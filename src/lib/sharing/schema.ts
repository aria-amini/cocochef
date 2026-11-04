import { createInsertSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { recipeShares, sharingProfiles } from '@/db/schema'

const reservedHandles = new Set([
	'api',
	'auth',
	'profile',
	'recipes',
	'sites',
	's',
	'settings',
	'home',
	'ingredients',
	'groceries',
	'pantry',
	'coming-soon',
	'admin',
	'login',
	'signup',
	'www',
])

export const sharingProfileInput = createInsertSchema(sharingProfiles, {
	handle: z
		.string()
		.trim()
		.toLowerCase()
		.min(3)
		.max(40)
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'use letters, numbers, and single hyphens',
		)
		.refine(
			(handle) => !reservedHandles.has(handle),
			'that handle is reserved',
		),
	displayName: z.string().trim().min(1).max(80),
})
	.pick({ handle: true, displayName: true, autoPublish: true })
	.required()

export const recipeShareInput = createInsertSchema(recipeShares, {
	visibility: z.enum(['private', 'public']),
})
	.pick({
		recipeId: true,
		visibility: true,
	})
	.required()

export const publicRecipeInput = z.object({
	handle: z.string().max(40),
	slug: z.string().max(120),
})

export const unlistedRecipeInput = z.object({ token: z.string().uuid() })

export const webRecipeInput = z.object({
	site: z.string().max(253),
	slug: z.string().max(120),
})

export function sharingSlug(title: string) {
	return (
		title
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 80)
			.replace(/-$/, '') || 'recipe'
	)
}
