import { useSyncExternalStore } from 'react'

// The recipe you were last reading, so the recipes tab on a phone returns to it
// after a visit to another tab. It lasts for the browser tab's session, kept in
// session storage; where that is blocked the id lives for the page's lifetime.
const storageKey = 'dutch-oven:last-recipe'

const listeners = new Set<() => void>()

let fallback: string | undefined

// Set when storage refused a write: the in-memory id is then the truth, even if
// reading from storage still works (a full or read-only session store).
let writeFailed = false

function read() {
	if (writeFailed) return fallback

	try {
		return sessionStorage.getItem(storageKey) ?? undefined
	} catch {
		return fallback
	}
}

function set(id: string | undefined) {
	if (id === read()) return

	fallback = id

	try {
		if (id) sessionStorage.setItem(storageKey, id)
		else sessionStorage.removeItem(storageKey)
		writeFailed = false
	} catch {
		writeFailed = true
	}

	listeners.forEach((listener) => listener())
}

export const rememberRecipe = (id: string) => set(id)

export const getLastOpenedRecipe = read

// Forgets the remembered recipe, or only when it is `only`: a different recipe
// that cannot be opened is no reason to lose this one.
export const forgetRecipe = (only?: string) => {
	if (only === undefined || read() === only) set(undefined)
}

export function useLastOpenedRecipe() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener)

			return () => listeners.delete(listener)
		},
		read,
		() => undefined,
	)
}
