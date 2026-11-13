import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getAuth } from './config'

type Session = Awaited<
	ReturnType<ReturnType<typeof getAuth>['api']['getSession']>
>

const sessions = new WeakMap<Request, Promise<Session>>()

// The session behind this request, looked up once however many times a
// handler asks. Server code calls this, not getCurrentSession: calling a
// server function from inside another runs its whole middleware stack again.
export const readSession = createServerOnlyFn(() => {
	const request = getRequest()
	const known = sessions.get(request)

	if (known) return known

	const session = getAuth().api.getSession({ headers: request.headers })
	sessions.set(request, session)

	return session
})

// For the browser and route loaders, which reach the session over the network.
export const getCurrentSession = createServerFn({ method: 'GET' }).handler(() =>
	readSession(),
)

// Who is looking: the account's id, or a stable stand-in for a visitor with
// no session, so public recipes can be read without creating an account.
export const getViewerId = createServerOnlyFn(async () => {
	const session = await readSession()

	return session ? session.user.id : 'visitor'
})

// The signed-in account, if any.
export async function getAccountId() {
	const session = await readSession()

	return session ? session.user.id : null
}

// For anything that saves: recipes, the pantry, the grocery list, cooking.
export async function requireAccountId(action: string) {
	const accountId = await getAccountId()

	if (!accountId) throw new Error(`sign in to ${action}`)

	return accountId
}
