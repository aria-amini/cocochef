import { useQuery } from '@tanstack/react-query'

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
