import { CarrotIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'

import { PageTitle } from '@/components/page'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/coming-soon/$feature')({
	loader: ({ params }) => {
		if (params.feature !== 'ingredients' && params.feature !== 'groceries')
			throw notFound()

		return { feature: params.feature }
	},
	component: ComingSoon,
})

function ComingSoon() {
	const { feature } = Route.useLoaderData()
	const Icon = feature === 'ingredients' ? CarrotIcon : ShoppingCartIcon

	return (
		<main className="flex-1 p-6 md:p-10">
			<div className="max-w-lg">
				<Icon
					size={40}
					weight="duotone"
					className="text-kitchen-basil mb-5"
					aria-hidden
				/>
				<PageTitle>{feature}</PageTitle>
				<p className="mt-3 text-lg font-semibold">work in progress</p>
				<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
					we’re still working on this part of the kitchen. your recipes are
					ready to use.
				</p>
				<Link
					to="/recipes"
					className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}
				>
					back to recipes
				</Link>
			</div>
		</main>
	)
}
