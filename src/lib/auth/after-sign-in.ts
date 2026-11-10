// What a signed-out visitor asked for before the sign-in dialog opened, so it
// still happens once they are in. Google sign-in leaves the page and comes back
// to it, so the request lives in session storage rather than component state.
import { z } from 'zod'

const afterSignIn = z.object({
	action: z.enum(['save', 'edit']),
	recipeId: z.string(),
})

export type AfterSignIn = z.infer<typeof afterSignIn>

const storedRequest = afterSignIn.extend({ at: z.number() })

const storageKey = 'after-sign-in'

// A request left behind by a sign-in that never finished should not fire on
// some later, unrelated visit.
const maxAgeMs = 10 * 60 * 1000

export function rememberAfterSignIn(request: AfterSignIn) {
	try {
		sessionStorage.setItem(
			storageKey,
			JSON.stringify({ ...request, at: Date.now() }),
		)
	} catch {
		// Without storage, the visitor clicks once more after signing in.
	}
}

// Removes the request as it reads it, so it runs once even if two buttons for
// the same recipe are on the page.
export function takeAfterSignIn(request: AfterSignIn): boolean {
	try {
		const raw = sessionStorage.getItem(storageKey)

		if (!raw) return false

		const stored = storedRequest.safeParse(JSON.parse(raw))

		if (
			!stored.success ||
			stored.data.action !== request.action ||
			stored.data.recipeId !== request.recipeId
		)
			return false

		sessionStorage.removeItem(storageKey)

		return Date.now() - stored.data.at < maxAgeMs
	} catch {
		return false
	}
}
