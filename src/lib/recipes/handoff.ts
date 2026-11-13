import type { readRecipe } from './server'

type Recipe = NonNullable<Awaited<ReturnType<typeof readRecipe>>>

type Cause = 'preload' | 'enter' | 'stay'

const fresh = 2_000

// A recipe read by a preload, for the loads right behind it. A touch preloads
// the id route, which reads the recipe and redirects to its readable address;
// the tap a moment later runs the id route again, and both would otherwise
// read the same recipe from the server. Only a preload hands one on, and
// nothing can edit a recipe between a touch and its tap, so what is taken is
// never older than an edit. Only in the browser: on the server it would be
// shared by every request.
export function createRecipeHandoff<
	T extends { id: string; publicPath: string | null },
>() {
	let handed: { recipe: T; at: number } | undefined

	return {
		hand(recipe: T, cause: Cause) {
			if (cause !== 'preload' || typeof window === 'undefined') return

			handed = { recipe, at: Date.now() }
		},
		// By id or by readable address. `stay` reloads the page the router is
		// on, which reads the recipe as it now is.
		get(key: string, cause: Cause) {
			if (!handed || cause === 'stay' || Date.now() - handed.at >= fresh)
				return undefined

			const { recipe } = handed

			return recipe.id === key || recipe.publicPath === key ? recipe : undefined
		},
	}
}

export const recipeHandoff = createRecipeHandoff<Recipe>()
