import type { readRecipe } from './server'

type Recipe = NonNullable<Awaited<ReturnType<typeof readRecipe>>>

type Cause = 'preload' | 'enter' | 'stay'

const fresh = 2_000

// A recipe just read by the id route, for the loads right behind it. The id
// route reads the recipe and redirects to its readable address, whose loader
// would read the same recipe again; a touch preloads the id route, and the
// tap a moment later runs it again too. A preload's read is handed on to
// both, for two seconds, since nothing can edit a recipe between a touch and
// its tap. A tap's read goes only to the readable address it is about to
// redirect to: a visit by id, as after an edit, always reads it again. Only
// in the browser: on the server it would be shared by every request.
export function createRecipeHandoff<
	T extends { id: string; publicPath: string | null },
>() {
	let handed: { recipe: T; at: number; cause: Cause } | undefined

	return {
		hand(recipe: T, cause: Cause) {
			if (cause === 'stay' || typeof window === 'undefined') return

			handed = { recipe, at: Date.now(), cause }
		},
		// By id or by readable address. `stay` reloads the page the router is
		// on, which reads the recipe as it now is.
		get(key: string, cause: Cause) {
			if (!handed || cause === 'stay' || Date.now() - handed.at >= fresh)
				return undefined

			const { recipe } = handed
			const byId = handed.cause === 'preload' && recipe.id === key

			return byId || recipe.publicPath === key ? recipe : undefined
		},
	}
}

export const recipeHandoff = createRecipeHandoff<Recipe>()
