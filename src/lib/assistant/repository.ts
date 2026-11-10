import { type Database, getDb } from '@/db/connection'
import { listPantryForUser } from '@/lib/pantry/repository'

import {
	markPantry,
	mockSuggestions,
	type SuggestionRequest,
	type SuggestionResponse,
} from './suggestions'

// Sections for the recipe being written, with the foods the cook's pantry holds
// marked. The mock stands in for a model until the suggestions are settled. A
// visitor, with no user, gets the sections unmarked.
export async function suggestSectionsForUser(
	userId: string | undefined,
	request: SuggestionRequest,
	database: Database = getDb(),
): Promise<SuggestionResponse> {
	const sections = mockSuggestions(request)

	if (!sections.length || !userId) return { sections }

	const pantry = await listPantryForUser(userId, database)

	return {
		sections: markPantry(
			sections,
			pantry.map((item) => item.name),
		),
	}
}
