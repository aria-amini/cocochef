import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/ingredients/new')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen/bulk' })
	},
})
