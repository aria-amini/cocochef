import { createFileRoute, redirect } from '@tanstack/react-router'

// Home is the app's front door now; old links to /home still reach it.
export const Route = createFileRoute('/_app/home')({
	beforeLoad: () => {
		throw redirect({ to: '/' })
	},
})
