import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicRecipePage } from '@/components/public-recipes'
import { readUnlistedRecipe } from '@/lib/sharing/server'

export const Route = createFileRoute('/_app/s/$token')({
	staticData: { header: 'none' },
	loader: async ({ params }) => {
		const recipe = await readUnlistedRecipe({ data: params })

		if (!recipe) throw notFound()

		return recipe
	},
	staleTime: 0,
	gcTime: 0,
	headers: () => ({
		'Cache-Control': 'private, no-store',
		'Referrer-Policy': 'no-referrer',
		'X-Robots-Tag': 'noindex, nofollow',
	}),
	head: () => ({
		meta: [
			{ title: 'shared recipe · cocochef' },
			{ name: 'robots', content: 'noindex, nofollow' },
			{ name: 'referrer', content: 'no-referrer' },
		],
	}),
	component: () => <PublicRecipePage recipe={Route.useLoaderData()} unlisted />,
})
