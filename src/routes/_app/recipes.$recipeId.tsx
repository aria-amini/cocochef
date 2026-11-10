import { createFileRoute, redirect } from '@tanstack/react-router'

import { RecipeAccessDenied } from '@/components/recipe-access-denied'
import { RecipeDetail } from '@/components/recipe-detail'
import { getRecipe } from '@/lib/recipes/server'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
	staticData: { header: 'none' },
	loader: async ({ params, location }) => {
		const recipe = await getRecipe({ data: { id: params.recipeId } })

		if (!recipe) return { recipe: null }

		// A published recipe lives at its readable address, so the one in the
		// address bar is the one to copy. Editing one someone else wrote happens
		// here, since its readable page only reads. The rest of the state, like
		// the search it was found by, goes along.
		if (recipe.publicPath && location.state.editing !== true)
			throw redirect({
				href: recipe.publicPath,
				replace: true,
				state: location.state,
			})

		return { recipe }
	},
	component: RecipePage,
})

function RecipePage() {
	const { recipe } = Route.useLoaderData()
	const { recipeId } = Route.useParams()

	return recipe ? (
		<RecipeDetail key={recipe.id} recipe={recipe} />
	) : (
		<RecipeAccessDenied recipeId={recipeId} />
	)
}
