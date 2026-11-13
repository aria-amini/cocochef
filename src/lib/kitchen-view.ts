import { useSyncExternalStore } from 'react'

import { pantrySpots, type PantrySpot } from '@/lib/pantry/spots'

// Where the cook left the kitchen, so it opens there again: the side that
// was open (on hand by default, or the grocery list), and the spot whose
// jars were showing. Kept in this browser only; a blocked or empty store
// just opens on hand and the fridge.
export type KitchenView = 'groceries'

const viewKey = 'cocochef:kitchen-view'

const spotKey = 'cocochef:kitchen-spot'

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

const subscribeSpot = subscribeTo(spotKey)

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

export function rememberKitchenSpot(spot: PantrySpot) {
	write(spotKey, spot)
}

export function useKitchenSpot(): PantrySpot | undefined {
	const spot = useSyncExternalStore(
		subscribeSpot,
		() => read(spotKey),
		() => undefined,
	)

	return pantrySpots.find((each) => each === spot)
}
