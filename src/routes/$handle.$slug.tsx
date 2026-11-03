import { createFileRoute, notFound } from '@tanstack/react-router'

import { AppChrome } from '@/components/app-chrome'
import { PublicRecipePage } from '@/components/public-recipes'
import { RecipeDetail } from '@/components/recipe-detail'
import { getCurrentSession } from '@/lib/auth/session'
import { getRecipe, listBooks } from '@/lib/recipes/server'
import { readPublicRecipe } from '@/lib/sharing/server'

export const Route = createFileRoute('/$handle/$slug')({
	loader: async ({ params }) => {
		const [recipe, session] = await Promise.all([
			readPublicRecipe({ data: params }),
			getCurrentSession(),
		])

		if (!recipe) throw notFound()

		// Anyone the app already knows gets the recipe in the app, with the
		// sidebar, cooking, and saving, at this same readable address. Visitors
		// with no session (readers, crawlers, link previews) get the plain page;
		// no guest account is made for them.
		if (session) {
			const [full, books] = await Promise.all([
				getRecipe({ data: { id: recipe.id } }),
				listBooks(),
			])

			if (full) return { kind: 'app' as const, recipe: full, books }
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
			{ property: 'og:title', content: loaderData?.recipe.title ?? 'recipe' },
		],
	}),
	notFoundComponent: () => (
		<AppChrome>
			<RecipeAccessDenied />
		</AppChrome>
	),
	component: SharedRecipe,
})

function SharedRecipe() {
	const data = Route.useLoaderData()

	return data.kind === 'app' ? (
		<AppChrome>
			<RecipeDetail recipe={data.recipe} books={data.books} />
		</AppChrome>
	) : (
		<PublicRecipePage recipe={data.recipe} />
	)
}
