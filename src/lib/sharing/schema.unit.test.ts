import { describe, expect, test } from 'vite-plus/test'

import { recipeShareInput, sharingProfileInput, sharingSlug } from './schema'

describe('public addresses', () => {
	test('normalizes handles and rejects reserved routes and malformed names', () => {
		const base = { displayName: 'Aria', autoPublish: false }
		expect(
			sharingProfileInput.parse({ ...base, handle: '  Aria-Amini ' }).handle,
		).toBe('aria-amini')

		for (const handle of [
			'recipes',
			'sites',
			'profile',
			's',
			'api',
			'aria--amini',
			'-aria',
			'aria/',
			'a',
		])
			expect(sharingProfileInput.safeParse({ ...base, handle }).success).toBe(
				false,
			)
	})
	test('requires explicit visibility and makes bounded readable slugs', () => {
		expect(recipeShareInput.safeParse({ recipeId: 'recipe' }).success).toBe(
			false,
		)
		expect(
			recipeShareInput.safeParse({ recipeId: 'recipe', visibility: 'friends' })
				.success,
		).toBe(false)
		expect(sharingSlug('Crème fraîche & pasta!')).toBe('creme-fraiche-pasta')
		expect(sharingSlug('🍲')).toBe('recipe')
		expect(sharingSlug('a'.repeat(200))).toHaveLength(80)
	})
})
