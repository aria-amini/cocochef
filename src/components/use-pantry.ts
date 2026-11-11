import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { groceryLine } from '@/lib/groceries/list'
import { listGroceries } from '@/lib/groceries/server'
import {
	deletePantryItem,
	markHave,
	pantryOnHand,
	setPantryItemLevel,
} from '@/lib/pantry/server'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { ingredientSubject } from '@/lib/recipes/ingredient-line'

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

// What is still to buy on the reader's grocery list, as typed there.
export function useWaitingGroceries(enabled: boolean) {
	return useQuery({
		queryKey: ['groceries', 'waiting'],
		queryFn: async () =>
			(await listGroceries())
				.filter((item) => !item.checkedAt)
				.map((item) => item.text),
		enabled,
		staleTime: 0,
	})
}

// "I have this", for a line the pantry did not know: one tap, and undo puts
// the pantry back as it was.
export function useMarkHave() {
	const client = useQueryClient()
	const refresh = () => client.invalidateQueries({ queryKey: ['pantry'] })

	return async (line: string) => {
		const food = ingredientSubject(groceryLine(line))

		try {
			const marked = await markHave({
				data: { text: line, category: ingredientCategory(line) },
			})

			await refresh()

			if (!marked) return

			toast(`marked ${food} as have it`, {
				action: {
					label: 'undo',
					onClick: async () => {
						if (marked.created)
							await deletePantryItem({ data: { id: marked.id } })
						else if (marked.level)
							await setPantryItemLevel({
								data: { id: marked.id, level: marked.level },
							})
						await refresh()
					},
				},
			})
		} catch {
			toast.error(`couldn't mark ${food} — try again`)
		}
	}
}
