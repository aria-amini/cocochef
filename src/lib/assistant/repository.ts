import { type Database, getDb } from '@/db/connection'
import { listPantryForUser } from '@/lib/pantry/repository'

import { markPantry, type SuggestedSection } from './suggestions'

// Suggested sections with the foods the cook's pantry holds marked. A visitor,
// with no user, gets them unmarked.
export async function markPantryForUser(
	userId: string | undefined,
	sections: SuggestedSection[],
	database: Database = getDb(),
): Promise<SuggestedSection[]> {
	if (!sections.length || !userId) return sections

	const pantry = await listPantryForUser(userId, database)

	return markPantry(
		sections,
		pantry.map((item) => item.name),
	)
}
