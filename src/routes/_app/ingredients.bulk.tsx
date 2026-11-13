import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { catalogSectionId } from '@/lib/pantry/catalog'

// Stocking up lives in the kitchen now; old links still reach it.
export const Route = createFileRoute('/_app/ingredients/bulk')({
	validateSearch: z.object({
		cat: catalogSectionId.optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({ to: '/kitchen/bulk', search })
	},
})
