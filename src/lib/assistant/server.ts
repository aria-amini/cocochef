import { createServerFn } from '@tanstack/react-start'

import { getCurrentSession } from '@/lib/auth/session'

import { amountRequest, mockAmounts } from './amounts'
import { mockRegroup, regroupRequest } from './regroup'
import { suggestSectionsForUser } from './repository'
import {
	mockSectionLines,
	mockSectionName,
	sectionLinesRequest,
	sectionNameRequest,
	suggestionRequest,
} from './suggestions'

// Sections the editor offers under the ingredients. Suggesting never creates a
// guest session: a visitor gets them unmarked.
export const suggestIngredientSections = createServerFn({ method: 'POST' })
	.validator(suggestionRequest)
	.handler(async ({ data }) => {
		const session = await getCurrentSession()

		return suggestSectionsForUser(session?.user.id, data)
	})

// The grouping the editor offers for the ingredients, from the steps they go
// into. The mock stands in for a model until the offer is settled.
export const regroupIngredients = createServerFn({ method: 'POST' })
	.validator(regroupRequest)
	.handler(({ data }) => mockRegroup(data))

// Lines for a section the cook has just named, shown inside it.
export const suggestSectionLines = createServerFn({ method: 'POST' })
	.validator(sectionLinesRequest)
	.handler(({ data }) => ({ lines: mockSectionLines(data) }))

// A likely amount for each line written without one.
export const suggestAmounts = createServerFn({ method: 'POST' })
	.validator(amountRequest)
	.handler(({ data }) => mockAmounts(data))

// A name for a section that has none, from what is in it.
export const suggestSectionName = createServerFn({ method: 'POST' })
	.validator(sectionNameRequest)
	.handler(({ data }) => ({ name: mockSectionName(data) }))
