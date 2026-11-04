import { useSyncExternalStore } from 'react'

// The recipe you were last reading, so the recipes tab on a phone returns to it
// after a visit to another tab. It lasts for the browser tab's session.
const storageKey = 'dutch-oven:last-recipe'

const listeners = new Set<() => void>()

let lastOpened: string | undefined

try {
	lastOpened = sessionStorage.getItem(storageKey) ?? undefined
} catch {
	// Storage can be blocked; the id then lives for the page's lifetime.
}

function set(id: string | undefined) {
	if (id === lastOpened) return

	lastOpened = id

	try {
		if (id) sessionStorage.setItem(storageKey, id)
		else sessionStorage.removeItem(storageKey)
	} catch {
		// Same: the in-memory id still works.
	}

	listeners.forEach((listener) => listener())
}

export const rememberRecipe = (id: string) => set(id)

export const forgetRecipe = () => set(undefined)

export function useLastOpenedRecipe() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener)

			return () => listeners.delete(listener)
		},
		() => lastOpened,
		() => undefined,
	)
}
