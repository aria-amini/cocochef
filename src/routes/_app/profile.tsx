import { createFileRoute, redirect } from '@tanstack/react-router'

// Photo and sharing settings now live together on /settings. The parent route
// runs first for /profile/sharing too, so it sends that old address to the
// public profile section itself.
export const Route = createFileRoute('/_app/profile')({
	beforeLoad: ({ location }) => {
		const nested = location.pathname.replace(/\/$/, '') !== '/profile'

		throw redirect({
			to: '/settings',
			replace: true,
			...(nested && { hash: 'public-profile' }),
		})
	},
})
