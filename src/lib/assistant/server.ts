import { createServerFn } from '@tanstack/react-start'

import { getCurrentSession } from '@/lib/auth/session'

import { suggestSectionsForUser } from './repository'
import { suggestionRequest } from './suggestions'

// Sections the editor offers under the ingredients. Suggesting never creates a
// guest session: a visitor gets them unmarked.
export const suggestIngredientSections = createServerFn({ method: 'POST' })
	.validator(suggestionRequest)
	.handler(async ({ data }) => {
		const session = await getCurrentSession()

		return suggestSectionsForUser(session?.user.id, data)
	})
