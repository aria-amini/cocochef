import { createFileRoute, redirect } from '@tanstack/react-router'

// The old /profile/sharing page is a section of /settings.
export const Route = createFileRoute('/_app/profile/$')({
	beforeLoad: () => {
		throw redirect({ to: '/settings', hash: 'public-profile', replace: true })
	},
})
