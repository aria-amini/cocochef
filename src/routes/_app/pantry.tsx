import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/pantry')({
	beforeLoad: () => {
		throw redirect({ to: '/kitchen' })
	},
})
