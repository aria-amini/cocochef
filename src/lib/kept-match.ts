import { useMatch } from '@tanstack/react-router'
import { useState } from 'react'

// The pages the app keeps alive behind the others: the four tabs.
export const keptRoutes = [
	'/_app/',
	'/_app/recipes/',
	'/_app/groceries',
	'/_app/pantry/',
] as const

export type KeptRoute = (typeof keptRoutes)[number]

// Each kept page's address.
export const keptPaths: Record<KeptRoute, string> = {
	'/_app/': '/',
	'/_app/recipes/': '/recipes',
	'/_app/groceries': '/groceries',
	'/_app/pantry/': '/pantry',
}

// A kept page's match: the route's own while it is the page shown, and the
// last it had while it waits hidden behind another, where the router has
// none for it. What it read is still there when it is shown again, and
// fresh once the router reads it again.
export function useKeptMatch<TRoute extends KeptRoute>(from: TRoute) {
	const match = useMatch({ from, shouldThrow: false })
	const [kept, setKept] = useState(match)

	if (match && match !== kept) setKept(match)

	const shown = match ?? kept

	if (!shown) throw new Error(`${from} is kept only once it has been shown`)

	// Shown only once its loader has answered, as the router's own page is.
	const { loaderData, search } = shown

	if (loaderData === undefined)
		throw new Error(`${from} is kept only once it has loaded`)

	return { loaderData, search }
}

// Where each kept tab was scrolled to while it was the page shown.
export const keptScroll = new Map<KeptRoute, number>()

// Set by a tab's own button, so the tab it opens returns to its own place
// rather than to the top; back and forward are the router's to restore.
let tabJump = false

export function markTabJump() {
	tabJump = true
}

export function takeTabJump() {
	const was = tabJump

	tabJump = false

	return was
}
