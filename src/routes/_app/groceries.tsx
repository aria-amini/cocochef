import { createFileRoute, redirect } from '@tanstack/react-router'

// The grocery list is the kitchen's shop now; old links still reach it.
export const Route = createFileRoute('/_app/groceries')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen/shop' })
	},
})
