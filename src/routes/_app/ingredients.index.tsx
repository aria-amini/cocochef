import { createFileRoute, redirect } from '@tanstack/react-router'

// Ingredients and groceries are one kitchen now; old links still reach it.
export const Route = createFileRoute('/_app/ingredients/')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen' })
	},
})
