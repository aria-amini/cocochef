import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { catalogSectionId } from '@/lib/pantry/catalog'
import { shelfOfAisle } from '@/lib/pantry/kinds'

// Adding food lives on the shelves now, beside what's kept; old links to
// an aisle open its shelf.
export const Route = createFileRoute('/_app/pantry/bulk')({
	validateSearch: z.object({
		cat: catalogSectionId.optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: '/pantry/staples',
			search: search.cat ? { shelf: shelfOfAisle(search.cat) } : {},
			replace: true,
		})
	},
})
