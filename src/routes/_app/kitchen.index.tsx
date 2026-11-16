import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

// The kitchen was one tab with two sides; each is a tab of its own now. Old
// links still reach the side they asked for, with the item they opened.
export const Route = createFileRoute('/_app/kitchen/')({
	validateSearch: z.object({
		view: z.enum(['groceries']).optional().catch(undefined),
		shop: z.boolean().optional().catch(undefined),
		item: z.string().optional(),
	}),
	beforeLoad: ({ search: { view, shop, item } }) => {
		if (view || shop)
			throw redirect({ to: '/groceries', search: { item }, replace: true })

		throw redirect({
			to: '/pantry',
			search: { item },
			replace: true,
		})
	},
})
