import {
	CheckCircleIcon,
	CookingPotIcon,
	ShoppingCartIcon,
	StackIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'

import { PageTitle } from '@/components/page'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_app/groceries')({
	component: Groceries,
})

const plans = [
	{
		icon: CookingPotIcon,
		title: 'pick recipes, get one list',
		body: 'choose what you are cooking this week and the ingredients land in one place.',
	},
	{
		icon: StackIcon,
		title: 'skips what you already have',
		body: 'your ingredients are checked off the list before you leave the house.',
	},
	{
		icon: CheckCircleIcon,
		title: 'tick things off in the store',
		body: 'big targets for one thumb, and the list remembers where you left off.',
	},
] as const

// Work in progress: the page exists so the destination is in the nav, but the
// list itself is not built yet.
function Groceries() {
	return (
		<main className="flex-1">
			<div className="flex max-w-2xl flex-col gap-8 p-6 md:p-10">
				<div className="flex flex-wrap items-center gap-3">
					<PageTitle>groceries</PageTitle>
					<Badge>work in progress</Badge>
				</div>
				<section className="border-foreground/50 bg-kitchen-yolk/25 flex flex-col items-start gap-4 rounded-xl border border-dashed p-6">
					<span className="bg-kitchen-yolk grid size-12 place-items-center rounded-full">
						<ShoppingCartIcon size={24} weight="bold" aria-hidden />
					</span>
					<div className="flex flex-col gap-2">
						<h2 className="text-2xl font-bold">your shopping list is coming</h2>
						<p className="text-foreground/70 text-sm font-semibold">
							this page is a placeholder. nothing here saves yet.
						</p>
					</div>
					<Link
						to="/recipes"
						className="bg-kitchen-yolk focus-visible:outline-kitchen-eggplant rounded-md px-4 py-2.5 text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
					>
						back to recipes
					</Link>
				</section>
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold">what it will do</h2>
					<ul className="border-border bg-card overflow-hidden rounded-xl border">
						{plans.map(({ icon: Icon, title, body }) => (
							<li
								key={title}
								className="border-foreground/15 flex items-start gap-3 border-b px-4 py-3.5 last:border-b-0"
							>
								<Icon
									size={22}
									className="text-muted-foreground mt-0.5 shrink-0"
									aria-hidden
								/>
								<div>
									<p className="text-sm font-semibold">{title}</p>
									<p className="text-muted-foreground mt-0.5 text-sm">{body}</p>
								</div>
							</li>
						))}
					</ul>
				</section>
			</div>
		</main>
	)
}
