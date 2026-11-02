import { CarrotIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'

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
				<h1 className="text-4xl font-bold tracking-tight">{feature}</h1>
				<p className="mt-3 text-lg font-semibold">work in progress</p>
				<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
					we’re still working on this part of the kitchen. your recipes are
					ready to use.
				</p>
				<Link
					to="/recipes"
					className="bg-kitchen-yolk focus-visible:outline-kitchen-eggplant mt-6 inline-flex rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					back to recipes
				</Link>
			</div>
		</main>
	)
}
