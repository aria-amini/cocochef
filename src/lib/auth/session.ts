import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getAuth } from './config'

export const getCurrentSession = createServerFn({ method: 'GET' }).handler(() =>
	getAuth().api.getSession({ headers: getRequestHeaders() }),
)

// Who is looking: any session's own id, so a guest still reaches their own
// shelf, and a stable stand-in for a visitor with no session, so public recipes
// can be read without creating an account.
export const getViewerId = createServerFn({ method: 'GET' }).handler(
	async () => {
		const session = await getCurrentSession()

		return session ? session.user.id : 'visitor'
	},
)

// Guests get a session on first use, so pantry and cooking work before sign-up.
export const requireUserId = createServerFn({ method: 'POST' }).handler(
	async () => {
		const session = await getCurrentSession()

		if (session) return session.user.id

		const anonymous = await getAuth().api.signInAnonymous({
			headers: getRequestHeaders(),
		})

		if (!anonymous) throw new Error('Failed to create anonymous session')

		return anonymous.user.id
	},
)

// For actions that keep or publish recipes, which a guest session can't do.
export async function requireAccountId(action: string) {
	const session = await getCurrentSession()

	if (!session || session.user.isAnonymous)
		throw new Error(`sign in to ${action}`)

	return session.user.id
}
