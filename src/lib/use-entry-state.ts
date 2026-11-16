import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

// One kind of thing a page remembers, by history entry: declared once beside
// the page, as `const words = entryMemory<string>()`.
export const entryMemory = <T>() => new Map<string, T>()

// useState, remembered in `memory` for this point in the tab's history, by
// the key scroll restoration uses. Back returns to the same entry, so the page
// comes back as it was left, and as long, so the scroll lands where it was.
// Kept for the tab's life; a reload starts over. Without a memory it is plain
// state.
export function useEntryState<T>(
	memory: Map<string, T> | undefined,
	initial: T,
) {
	const entry = useRouterState({
		select: (state) => state.location.state.__TSR_key ?? state.location.href,
	})

	const [value, setValue] = useState<T>(() => {
		const kept = memory?.get(entry)

		return kept === undefined ? initial : kept
	})

	useEffect(() => {
		memory?.set(entry, value)
	}, [memory, entry, value])

	return [value, setValue] as const
}
