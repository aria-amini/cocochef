import { describe, expect, test, vi } from 'vite-plus/test'

// A database whose tags table cannot be read.
vi.mock('@/db/connection', () => ({
	getDb: () => ({
		select: () => ({
			from: () => Promise.reject(new Error('meal_tags is unavailable')),
		}),
	}),
}))

const { withMealTags } = await import('./meal-tags.server')

describe('withMealTags', () => {
	test('falls back to title words when the saved tags cannot be read', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)

		const [found] = await withMealTags([
			{ recipeId: 'r1', title: 'Cajun Chicken Tacos' },
		])

		expect(found?.tags).toMatchObject({
			proteins: ['chicken'],
			forms: ['tacos'],
		})
	})
})
