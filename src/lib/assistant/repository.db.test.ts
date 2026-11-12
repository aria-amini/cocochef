import { describe, expect, test } from '@tests/support/fixtures/db'

import { user } from '@/db/schema'
import { createPantryItemsForUser } from '@/lib/pantry/repository'

import { markPantryForUser } from './repository'
import { mockSuggestions } from './suggestions'

describe('suggested sections', () => {
	test('marks the foods in the cook’s own pantry', async ({ db }) => {
		const [cook, neighbour] = [crypto.randomUUID(), crypto.randomUUID()]

		await db.insert(user).values(
			[cook, neighbour].map((id) => ({
				id,
				name: 'Test User',
				email: `${id}@example.com`,
				createdAt: new Date(),
				updatedAt: new Date(),
			})),
		)
		await createPantryItemsForUser(
			cook,
			[{ name: 'cumin', quantity: 1, category: 'spices' }],
			db,
		)
		await createPantryItemsForUser(
			neighbour,
			[{ name: 'smoked paprika', quantity: 1, category: 'spices' }],
			db,
		)

		const sections = await markPantryForUser(
			cook,
			mockSuggestions({ title: 'chili', ingredients: [] }),
			db,
		)

		const inPantry = sections
			.flatMap((section) => section.ingredients)
			.filter((ingredient) => ingredient.inPantry)
			.map((ingredient) => ingredient.line)

		expect(inPantry).toEqual(['2 tsp ground cumin'])
	})

	test('leaves a visitor’s suggestions unmarked', async ({ db }) => {
		const sections = await markPantryForUser(
			undefined,
			mockSuggestions({ title: 'chili', ingredients: [] }),
			db,
		)

		expect(sections.length).toBeGreaterThan(0)
		expect(
			sections
				.flatMap((section) => section.ingredients)
				.some((i) => i.inPantry),
		).toBe(false)
	})
})
