import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { pantrySpots } from '@/lib/pantry/spots'

// Ingredients and groceries are one kitchen now; old links still reach it.
export const Route = createFileRoute('/_app/ingredients/')({
	validateSearch: z.object({
		spot: z.enum(pantrySpots).optional().catch(undefined),
		item: z.string().optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({ to: '/kitchen', search })
	},
})
