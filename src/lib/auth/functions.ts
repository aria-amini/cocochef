import { redirect } from '@tanstack/react-router'

import { getCurrentSession } from './session'

export async function redirectAuthenticatedUsers() {
	const session = await getCurrentSession()

	if (session) {
		throw redirect({ to: '/' })
	}
}
