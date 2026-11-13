import { createFileRoute, redirect } from '@tanstack/react-router'

// Shopping is the kitchen with the list alone now; old links still reach it.
export const Route = createFileRoute('/_app/kitchen/shop')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen', search: { shop: true } })
	},
})
