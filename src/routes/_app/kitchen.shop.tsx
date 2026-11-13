import { createFileRoute, redirect } from '@tanstack/react-router'

// Shopping happens on the kitchen's grocery list; old links still reach it.
export const Route = createFileRoute('/_app/kitchen/shop')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen', search: { view: 'groceries' } })
	},
})
