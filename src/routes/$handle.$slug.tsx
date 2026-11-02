import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { PublicRecipePage } from '@/components/public-recipes'
import { getCurrentSession } from '@/lib/auth/session'
import { readPublicRecipe } from '@/lib/sharing/server'

export const Route = createFileRoute('/$handle/$slug')({
	loader: async ({ params }) => {
		const [recipe, session] = await Promise.all([
			readPublicRecipe({ data: params }),
			getCurrentSession(),
		])

		if (!recipe) throw notFound()

		// Anyone the app already knows gets the recipe in the app, with the
		// sidebar, cooking, and saving. Visitors with no session (readers,
		// crawlers, link previews) get this page; no guest account is made for them.
		if (session)
			throw redirect({
				to: '/recipes/$recipeId',
				params: { recipeId: recipe.id },
			})

		return recipe
	},
	staleTime: 0,
	gcTime: 0,
	headers: () => ({ 'Cache-Control': 'private, no-store' }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.title} · dutch-oven`
					: 'recipe · dutch-oven',
			},
			{ property: 'og:title', content: loaderData?.title ?? 'recipe' },
		],
	}),
	component: () => <PublicRecipePage recipe={Route.useLoaderData()} />,
})
