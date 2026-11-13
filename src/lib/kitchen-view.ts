import { useSyncExternalStore } from 'react'

// Where the cook left the kitchen, so it opens there again: the side that
// was open, on hand by default or the grocery list. Kept in this browser
// only; a blocked or empty store just opens on hand.
export type KitchenView = 'groceries'

const viewKey = 'cocochef:kitchen-view'

function read(key: string) {
	try {
		return localStorage.getItem(key) ?? undefined
	} catch {
		return undefined
	}
}

function write(key: string, value: string | undefined) {
	try {
		if (value) localStorage.setItem(key, value)
		else localStorage.removeItem(key)
	} catch {
		return
	}

	window.dispatchEvent(new Event(key))
}

const subscribeTo = (key: string) => (onChange: () => void) => {
	window.addEventListener(key, onChange)
	window.addEventListener('storage', onChange)

	return () => {
		window.removeEventListener(key, onChange)
		window.removeEventListener('storage', onChange)
	}
}

const subscribeView = subscribeTo(viewKey)

export function rememberKitchenView(view: KitchenView | undefined) {
	write(viewKey, view)
}

export function useKitchenView(): KitchenView | undefined {
	const view = useSyncExternalStore(
		subscribeView,
		() => read(viewKey),
		() => undefined,
	)

	return view === 'groceries' ? view : undefined
}
