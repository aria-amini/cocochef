import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
	dropPlan,
	finishCook,
	getPlan,
	listInProgress,
	planCook,
	unfinishCook,
} from '@/lib/cooking/server'

export type Plan = { skipped: string[]; plannedAt: Date }

const plansKey = ['plans'] as const

const planKey = (recipeId: string) => [...plansKey, 'recipe', recipeId]

// Whether a recipe is in progress, and what's skipped for it while it is.
export function usePlan(recipeId: string, enabled: boolean) {
	return useQuery({
		queryKey: planKey(recipeId),
		queryFn: () => getPlan({ data: { recipeId } }),
		enabled,
		staleTime: 0,
	})
}

// Every recipe in progress, for home.
export function useInProgress(enabled: boolean) {
	return useQuery({
		queryKey: [...plansKey, 'in-progress'],
		queryFn: () => listInProgress(),
		enabled,
		staleTime: 0,
	})
}

// Putting a recipe in progress and taking it off. The recipe's own plan changes
// at once, so its pill counts right while the write lands; home's list
// catches up after.
export function usePlanWrites() {
	const client = useQueryClient()

	const refresh = () => client.invalidateQueries({ queryKey: plansKey })

	async function write(
		recipeId: string,
		plan: Plan | null,
		send: () => Promise<void>,
	) {
		await client.cancelQueries({ queryKey: planKey(recipeId) })
		client.setQueryData(planKey(recipeId), plan)

		try {
			await send()
		} finally {
			await refresh()
		}
	}

	const plan = (recipeId: string, skipped: string[], plannedAt?: Date) =>
		write(
			recipeId,
			{ skipped, plannedAt: plannedAt ?? new Date() },
			async () => {
				await planCook({ data: { recipeId, skipped, plannedAt } })
			},
		)

	const drop = (recipeId: string) =>
		write(recipeId, null, async () => {
			await dropPlan({ data: { recipeId } })
		})

	// Back as it was: in progress with its skips and its day, or off it.
	const restore = (recipeId: string, before: Plan | null) =>
		before ? plan(recipeId, before.skipped, before.plannedAt) : drop(recipeId)

	// Cooked: off what's in progress, and the food it used up out of the pantry. Hands back
	// how things stood, for undo.
	async function finish(recipeId: string, usedUp: string[]) {
		let done: Cooked | undefined

		await write(recipeId, null, async () => {
			done = await finishCook({ data: { recipeId, usedUp } })
		})
		await client.invalidateQueries({ queryKey: ['pantry'] })

		return done
	}

	// Not cooked after all: as it was before.
	async function unfinish(recipeId: string, done: Cooked) {
		await write(recipeId, done.plan, () =>
			unfinishCook({ data: { recipeId, ...done } }),
		)
		await client.invalidateQueries({ queryKey: ['pantry'] })
	}

	return { plan, drop, restore, finish, unfinish }
}

type Cooked = Awaited<ReturnType<typeof finishCook>>
