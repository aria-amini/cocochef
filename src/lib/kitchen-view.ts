import { useSyncExternalStore } from 'react'

// Which side of the kitchen the cook last had open, so the tab reopens it:
// on hand (the default) or the grocery list. Kept in this browser only; a
// blocked or empty store just opens on hand.
export type KitchenView = 'groceries'

const key = 'cocochef:kitchen-view'

function read(): KitchenView | undefined {
	try {
		return localStorage.getItem(key) === 'groceries' ? 'groceries' : undefined
	} catch {
		return undefined
	}
}

function subscribe(onChange: () => void) {
	window.addEventListener(key, onChange)
	window.addEventListener('storage', onChange)

	return () => {
		window.removeEventListener(key, onChange)
		window.removeEventListener('storage', onChange)
	}
}

export function rememberKitchenView(view: KitchenView | undefined) {
	try {
		if (view) localStorage.setItem(key, view)
		else localStorage.removeItem(key)
	} catch {
		return
	}

	window.dispatchEvent(new Event(key))
}

export function useKitchenView() {
	return useSyncExternalStore(subscribe, read, () => undefined)
}
