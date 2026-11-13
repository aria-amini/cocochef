import { createServerFn } from '@tanstack/react-start'

import { getAccountId } from '@/lib/auth/session'
import { listActiveCookingForUser } from '@/lib/cooking/repository'
import { listGroceriesForUser } from '@/lib/groceries/repository'
import { getRecipeForUser } from '@/lib/recipes/repository'
import { checkableStepIndexes } from '@/lib/recipes/step-groups'

// A recipe left this long is a meal over, not one still cooking.
const cookingLasts = 6 * 60 * 60 * 1000

// What the cook is in the middle of, for home to lead with: a recipe being
// cooked, the step it is on and the one after; and a shop under way, with
// how much of the list is in the cart.
export const homeNow = createServerFn({ method: 'GET' }).handler(async () => {
	const accountId = await getAccountId()

	if (!accountId)
		return { signedIn: false, cooking: null, shopping: null, waiting: 0 }

	const [sessions, groceries] = await Promise.all([
		listActiveCookingForUser(accountId),
		listGroceriesForUser(accountId),
	])

	const latest = sessions
		.filter(
			(session) => Date.now() - session.updatedAt.getTime() < cookingLasts,
		)
		.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

	const recipe = latest
		? await getRecipeForUser(accountId, latest.recipeId)
		: null

	const steps = recipe ? checkableStepIndexes(recipe.steps) : []
	const done = new Set(latest?.checked ?? [])
	const at = steps.findIndex((index) => !done.has(`s${index}`))

	const cooking =
		latest && recipe
			? {
					recipeId: latest.recipeId,
					title: latest.title,
					minutesIn: Math.round(
						(Date.now() - latest.startedAt.getTime()) / 60_000,
					),
					steps: steps.length,
					// The step the cook is on, counted from one, and its words.
					on: at < 0 ? steps.length : at + 1,
					step: at < 0 ? null : (recipe.steps[steps[at] ?? 0] ?? null),
					next: at < 0 ? null : (recipe.steps[steps[at + 1] ?? -1] ?? null),
				}
			: null

	const inCart = groceries.filter((item) => item.checkedAt)
	const left = groceries.filter((item) => !item.checkedAt)

	// A shop is under way while anything is on the list: home says to finish
	// it until the list is cleared.
	const shopping = groceries.length
		? {
				inCart: inCart.length,
				total: groceries.length,
			}
		: null

	return { signedIn: true, cooking, shopping, waiting: left.length }
})
