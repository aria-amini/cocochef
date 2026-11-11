import { useSyncExternalStore } from 'react'

import { pantryCategories } from './model'

// How the ingredients page groups what the kitchen has: by category, by how
// soon it spoils, or by how much is left.
export const pantryViews = ['category', 'freshness', 'stock'] as const

export type PantryView = (typeof pantryViews)[number]

// Each grouping's folded sections, remembered in this browser. Categories
// all start folded, so the page opens on them and their counts; the other
// groupings fold only the section least worth a look. Where storage is
// blocked, the choice lasts for the page's lifetime.
const storageKeys: Record<PantryView, string> = {
	category: 'cocochef:folded-categories',
	freshness: 'cocochef:folded-freshness',
	stock: 'cocochef:folded-stock',
}

const startFolded: Record<PantryView, string> = {
	category: pantryCategories.join(','),
	freshness: 'months,years',
	stock: 'plenty',
}

const listeners = new Set<() => void>()

const fallback = new Map<PantryView, string>()

function read(view: PantryView) {
	try {
		return localStorage.getItem(storageKeys[view]) ?? startFolded[view]
	} catch {
		return fallback.get(view) ?? startFolded[view]
	}
}

function write(view: PantryView, value: string) {
	fallback.set(view, value)

	try {
		localStorage.setItem(storageKeys[view], value)
	} catch {
		// Kept in memory instead.
	}

	listeners.forEach((listener) => listener())
}

const parse = (value: string) => new Set(value.split(',').filter(Boolean))

export function useFoldedSections(view: PantryView) {
	const value = useSyncExternalStore(
		(listener) => {
			listeners.add(listener)

			return () => listeners.delete(listener)
		},
		() => read(view),
		() => startFolded[view],
	)

	const folded = parse(value)

	function setFolded(section: string, fold: boolean) {
		const next = parse(read(view))

		if (fold) next.add(section)
		else next.delete(section)
		write(view, [...next].join(','))
	}

	return { folded, setFolded }
}
