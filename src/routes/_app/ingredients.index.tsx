import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

// What is on hand is the pantry now; old links still reach it.
export const Route = createFileRoute('/_app/ingredients/')({
	validateSearch: z.object({
		item: z.string().optional().catch(undefined),
	}),
	beforeLoad: ({ search }) => {
		throw redirect({ to: '/pantry', search })
	},
})
