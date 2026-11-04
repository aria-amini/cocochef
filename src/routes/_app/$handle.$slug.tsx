import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicRecipePage } from '@/components/public-recipes'
import { RecipeAccessDenied } from '@/components/recipe-access-denied'
import { RecipeDetail } from '@/components/recipe-detail'
import { getCurrentSession } from '@/lib/auth/session'
import { getRecipe } from '@/lib/recipes/server'
import { readOwnedRecipeAddress, readPublicRecipe } from '@/lib/sharing/server'

export const Route = createFileRoute('/_app/$handle/$slug')({
	staticData: { header: 'none' },
	loader: async ({ params }) => {
		const [recipe, session] = await Promise.all([
			readPublicRecipe({ data: params }),
			getCurrentSession(),
		])

		if (!recipe) {
			if (session && !session.user.isAnonymous) {
				const owned = await readOwnedRecipeAddress({ data: params })

				if (owned) {
					const full = await getRecipe({ data: { id: owned.id } })

					if (full) return { kind: 'app' as const, recipe: full }
				}
			}

			// Missing and private recipes look the same, and both are a real 404.
			throw notFound()
		}

		// Anyone the app already knows gets the recipe in the app, with the
		// sidebar, cooking, and saving, at this same readable address. Visitors
		// with no session (readers, crawlers, link previews) get the plain page;
		// no guest account is made for them.
		if (session) {
			const full = await getRecipe({ data: { id: recipe.id } })

			if (full) return { kind: 'app' as const, recipe: full }
		}

		return { kind: 'public' as const, recipe }
	},
	staleTime: 0,
	gcTime: 0,
	headers: () => ({ 'Cache-Control': 'private, no-store' }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.recipe.title} · dutch-oven`
					: 'recipe · dutch-oven',
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
		<RecipeDetail recipe={data.recipe} />
	) : (
		<PublicRecipePage recipe={data.recipe} />
	)
}
