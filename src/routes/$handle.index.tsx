import { createFileRoute, notFound } from '@tanstack/react-router'

import { PublicProfile } from '@/components/public-recipes'
import { readPublicProfile } from '@/lib/sharing/server'

export const Route = createFileRoute('/$handle/')({
	loader: async ({ params }) => {
		const profile = await readPublicProfile({ data: { handle: params.handle } })

		if (!profile) throw notFound()

		return profile
	},
	staleTime: 0,
	gcTime: 0,
	headers: () => ({ 'Cache-Control': 'private, no-store' }),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.displayName}’s recipes · dutch-oven`
					: 'recipes · dutch-oven',
			},
		],
	}),
	component: () => <PublicProfile profile={Route.useLoaderData()} />,
})
