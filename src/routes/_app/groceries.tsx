import { createFileRoute, redirect } from '@tanstack/react-router'

// The grocery list lives in the kitchen now; old links still reach it.
export const Route = createFileRoute('/_app/groceries')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen', search: { view: 'groceries' } })
	},
})
