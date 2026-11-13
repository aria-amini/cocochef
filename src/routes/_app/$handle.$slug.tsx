import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicRecipePage } from '@/components/public-recipes'
import { RecipeAccessDenied } from '@/components/recipe-access-denied'
import { RecipeDetail } from '@/components/recipe-detail'
import { readRecipeAt } from '@/lib/sharing/server'

export const Route = createFileRoute('/_app/$handle/$slug')({
	staticData: { header: 'none' },
	loader: async ({ params }) => {
		const found = await readRecipeAt({ data: params })

		// Missing and private recipes look the same, and both are a real 404.
		if (!found) throw notFound()

		return found
	},
	staleTime: 0,
	gcTime: 0,
	headers: () => ({ 'Cache-Control': 'private, no-store' }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.recipe.title} · cocochef`
					: 'recipe · cocochef',
			},
			{
				property: 'og:title',
				content: loaderData?.recipe.title ?? 'recipe',
			},
		],
	}),
	notFoundComponent: () => <RecipeAccessDenied />,
	component: SharedRecipe,
})

function SharedRecipe() {
	const data = Route.useLoaderData()

	return data.kind === 'app' ? (
		<RecipeDetail key={data.recipe.id} recipe={data.recipe} />
	) : (
		<PublicRecipePage recipe={data.recipe} />
	)
}
