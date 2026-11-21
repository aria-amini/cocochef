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

// The reader's grocery list, each line as typed there, with its id to
// change it by, the recipes it is for, and whether it's in the cart.
const groceryLines = async () =>
	((await listGroceries()) ?? []).map((item) => ({
		id: item.id,
		text: item.text,
		recipes: item.recipes,
		brand: item.brand,
		inCart: !!item.checkedAt,
	}))

export const groceryLinesKey = ['groceries', 'lines']

export function useGroceryLines(enabled: boolean) {
	return useQuery({
		queryKey: groceryLinesKey,
		queryFn: groceryLines,
		enabled,
		staleTime: 0,
	})
}

// What is still to buy: the lines not in the cart yet.
export function useWaitingGroceries(enabled: boolean) {
	return useQuery({
		queryKey: groceryLinesKey,
		queryFn: groceryLines,
		enabled,
		staleTime: 0,
		select: (lines) => lines.filter((line) => !line.inCart),
	})
}
