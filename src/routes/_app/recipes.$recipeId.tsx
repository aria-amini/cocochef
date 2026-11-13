import { createFileRoute, redirect } from '@tanstack/react-router'

import { RecipeAccessDenied } from '@/components/recipe-access-denied'
import { RecipeDetail } from '@/components/recipe-detail'
import { recipeHandoff } from '@/lib/recipes/handoff'
import { getRecipe } from '@/lib/recipes/server'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
	staticData: { header: 'none' },
	loader: async ({ params, location, cause }) => {
		// A touch preloads this route, and the tap a moment later runs it again.
		const recipe =
			recipeHandoff.get(params.recipeId, cause) ??
			(await getRecipe({ data: { id: params.recipeId } }))

		if (!recipe) return { recipe: null }

		recipeHandoff.hand(recipe, cause)

		// A published recipe lives at its readable address, so the one in the
		// address bar is the one to copy. Editing one someone else wrote happens
		// here, since its readable page only reads. The rest of the state, like
		// the search it was found by, goes along.
		if (recipe.publicPath && location.state.editing !== true) {
			// Redirect by route, not href: a preload follows only a route, and
			// with an href it would load this route again, which redirects again,
			// forever.
			const [, first = '', second = '', third = ''] =
				recipe.publicPath.split('/')

			const redirection = { replace: true, state: location.state }

			if (first === 'sites')
				throw redirect({
					to: '/sites/$site/$slug',
					params: { site: second, slug: third },
					...redirection,
				})

			throw redirect({
				to: '/$handle/$slug',
				params: { handle: first, slug: second },
				...redirection,
			})
		}

		return { recipe }
	},
	component: RecipePage,
})

function RecipePage() {
	const { recipe } = Route.useLoaderData()

	return recipe ? (
		<RecipeDetail key={recipe.id} recipe={recipe} />
	) : (
		<RecipeAccessDenied />
	)
}
