import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { RecipeDetail } from '@/components/recipe-detail'
import { getRecipe } from '@/lib/recipes/server'

export const Route = createFileRoute('/_app/recipes/$recipeId')({
	loader: async ({ params }) => {
		const recipe = await getRecipe({ data: { id: params.recipeId } })

		if (!recipe) throw notFound()

		// A published recipe lives at its readable address, so the one in the
		// address bar is the one to copy.
		if (recipe.publicPath)
			throw redirect({ href: recipe.publicPath, replace: true })

		return { recipe }
	},
	component: RecipePage,
})

function RecipePage() {
	const { recipe } = Route.useLoaderData()

	return <RecipeDetail recipe={recipe} />
}
