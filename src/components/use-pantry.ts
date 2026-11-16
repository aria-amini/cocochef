import { useQuery } from '@tanstack/react-query'

import { listGroceries } from '@/lib/groceries/server'
import { pantryOnHand } from '@/lib/pantry/server'

// The reader's pantry, for marking what a recipe needs that is already in the
// kitchen. Fetched fresh on each recipe, since it changes on another page.
export function usePantry(enabled: boolean) {
	return useQuery({
		queryKey: ['pantry'],
		queryFn: () => pantryOnHand(),
		enabled,
		staleTime: 0,
	})
}

// What is still to buy on the reader's grocery list, each line as typed
// there, with its id to change it by and the recipes it is for.
export function useWaitingGroceries(enabled: boolean) {
	return useQuery({
		queryKey: ['groceries', 'waiting'],
		queryFn: async () =>
			((await listGroceries()) ?? [])
				.filter((item) => !item.checkedAt)
				.map((item) => ({
					id: item.id,
					text: item.text,
					recipes: item.recipes,
				})),
		enabled,
		staleTime: 0,
	})
}
