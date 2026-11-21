import type { Icon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useSyncExternalStore } from 'react'

import { authClient } from '@/lib/auth/client'
import { countWaitingGroceries } from '@/lib/groceries/server'

export const groceryCountKey = ['grocery-count'] as const

// Kept per account, so signing in or out never shows another's count. Asked
// only once the session says who it is: signed out, there is no list.
const useWaiting = () => {
	const userId = authClient.useSession().data?.user.id

	return useQuery({
		queryKey: [...groceryCountKey, userId],
		queryFn: () => countWaitingGroceries(),
		enabled: !!userId,
		staleTime: 30_000,
	}).data
}

// The count as words for a screen reader, to follow the tab's name.
export function GroceryCount() {
	const waiting = useWaiting()

	return waiting ? <span className="sr-only">({waiting} to buy)</span> : null
}

// Foods just put on the list from somewhere else, such as a recipe: the
// groceries tab says so for a moment, so the cook sees where they went.
let added: { count: number; at: number } | undefined

const addedListeners = new Set<() => void>()

function subscribeAdded(listener: () => void) {
	addedListeners.add(listener)

	return () => {
		addedListeners.delete(listener)
	}
}

export function showAdded(count: number) {
	const at = Date.now()

	added = { count, at }
	addedListeners.forEach((listener) => listener())

	setTimeout(() => {
		if (added?.at !== at) return

		added = undefined
		addedListeners.forEach((listener) => listener())
	}, 1800)
}

// The groceries tab's cart: it tips, and "+4" shows over it, when foods
// were just added. The toast says it in words.
export function GroceryTabIcon({
	icon: TabIcon,
	size,
	weight,
}: {
	icon: Icon
	size: number
	weight: 'fill' | 'regular'
}) {
	const reduceMotion = useReducedMotion()

	const now = useSyncExternalStore(
		subscribeAdded,
		() => added,
		() => undefined,
	)

	return (
		<span className="relative inline-grid place-items-center">
			<motion.span
				key={now?.at ?? 'still'}
				className="inline-grid"
				animate={
					now && !reduceMotion
						? { rotate: [0, -16, 8, 0], y: [0, -3, 0, 0] }
						: {}
				}
				transition={{ duration: 0.6, ease: 'easeOut' }}
			>
				<TabIcon size={size} weight={weight} aria-hidden />
			</motion.span>
			<AnimatePresence>
				{now ? (
					<motion.span
						key={now.at}
						aria-hidden
						initial={reduceMotion ? false : { opacity: 0, y: 4, scale: 0.6 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
						className="bg-kitchen-yolk ring-background absolute -top-2 -right-4 rounded-full px-1.5 text-xs leading-4 font-bold tabular-nums ring-2"
					>
						+{now.count}
					</motion.span>
				) : null}
			</AnimatePresence>
		</span>
	)
}
