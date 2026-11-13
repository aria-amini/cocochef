import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

import { getAuth } from './config'

export const getCurrentSession = createServerFn({ method: 'GET' }).handler(() =>
	getAuth().api.getSession({ headers: getRequestHeaders() }),
)

// Who is looking: the account's id, or a stable stand-in for a visitor with
// no session, so public recipes can be read without creating an account.
export const getViewerId = createServerFn({ method: 'GET' }).handler(
	async () => {
		const session = await getCurrentSession()

		return session ? session.user.id : 'visitor'
	},
)

// The signed-in account, if any.
export async function getAccountId() {
	const session = await getCurrentSession()

	return session ? session.user.id : null
}

// For anything that saves: recipes, the pantry, the grocery list, cooking.
export async function requireAccountId(action: string) {
	const accountId = await getAccountId()

	if (!accountId) throw new Error(`sign in to ${action}`)

	return accountId
}
