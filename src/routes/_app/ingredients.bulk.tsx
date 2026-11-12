import { createFileRoute, redirect } from '@tanstack/react-router'

// Stocking up lives in the kitchen now; old links still reach it.
export const Route = createFileRoute('/_app/ingredients/bulk')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen/bulk' })
	},
})
