import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { authClient } from '@/lib/auth/client'
import { countWaitingGroceries } from '@/lib/groceries/server'
import { cn } from '@/lib/utils/ui'

export const groceryCountKey = ['grocery-count'] as const

// How long "+3" shows after items land on the list.
const pulseMs = 1600

// The items just added, said on the badge for a moment, wherever it shows.
let pulse: { added: number; at: number } | undefined

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
	listeners.add(listener)

	return () => listeners.delete(listener)
}

const notify = () => {
	for (const listener of listeners) listener()
}

export function pulseGroceries(added: number) {
	if (added < 1) return
	const now = { added, at: Date.now() }
	pulse = now
	notify()
	window.setTimeout(() => {
		if (pulse !== now) return
		pulse = undefined
		notify()
	}, pulseMs)
}

// Kept per account, so signing in or out never shows another's count.
const useWaiting = () => {
	const userId = authClient.useSession().data?.user.id

	return useQuery({
		queryKey: [...groceryCountKey, userId],
		queryFn: () => countWaitingGroceries(),
		staleTime: 30_000,
	}).data
}

// How many items are left to buy, on the groceries tab: a quiet number in
// muted ink, since a list never needs you now, nothing at none, and "+3" in
// yolk for a moment when a recipe adds three. Seen, not read: `GroceryCount`
// says it right after the tab's name.
export function GroceryBadge({ className }: { className?: string }) {
	const waiting = useWaiting()

	const added = useSyncExternalStore(
		subscribe,
		() => pulse,
		() => undefined,
	)

	if (!added && !waiting) return null

	return (
		<span
			key={added?.at ?? 'count'}
			aria-hidden
			className={cn(
				'grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs leading-none font-semibold tabular-nums',
				added
					? 'animate-in zoom-in-50 bg-kitchen-yolk/60 text-foreground duration-300'
					: 'text-muted-foreground',
				className,
			)}
		>
			{added ? `+${added.added}` : waiting}
		</span>
	)
}

// The count as words for a screen reader, to follow the tab's name.
export function GroceryCount() {
	const waiting = useWaiting()

	return waiting ? <span className="sr-only">({waiting} to buy)</span> : null
}
