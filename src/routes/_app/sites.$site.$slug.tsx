import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicRecipePage } from '@/components/public-recipes'
import { readWebRecipe } from '@/lib/sharing/server'

export const Route = createFileRoute('/_app/sites/$site/$slug')({
	staticData: { header: 'none' },
	loader: async ({ params }) => {
		const recipe = await readWebRecipe({ data: params })

		if (!recipe) throw notFound()

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
		],
	}),
	component: () => <PublicRecipePage recipe={Route.useLoaderData()} />,
})
