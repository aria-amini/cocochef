import { ArrowRightIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { z } from 'zod'

import { FinderPanel, type FinderFilters } from '@/components/recipe-finder'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { buttonVariants } from '@/components/ui/button'
import { homeNow } from '@/lib/home/server'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/')({
	// A search asked for elsewhere ("back to results", "find a recipe") lands
	// here holding its words.
	validateSearch: z.object({
		q: z.string().max(200).optional().catch(undefined),
	}),
	loader: () => homeNow(),
	component: Home,
})

type Now = Awaited<ReturnType<typeof homeNow>>

const weekday = new Intl.DateTimeFormat('en', { weekday: 'long' })

// The part of the day, as a cook says it.
function partOfDay(hour: number) {
	return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

// What the cook is in the middle of leads: a recipe still cooking, then a
// shop under way. Finding something to cook is below.
function Home() {
	const now = Route.useLoaderData()
	// The cook's own clock, read once.
	const [today] = useState(() => new Date())
	// What narrows the search: a rating, parts of a meal, a site.
	const [filters, setFilters] = useState<FinderFilters>({ picks: {} })

	const headline = now.cooking
		? 'still cooking'
		: now.shopping
			? 'finish shopping'
			: 'what are you making?'

	return (
		<main className="min-w-0 flex-1">
			<div className="flex w-full max-w-3xl min-w-0 flex-col gap-8 p-6 pb-28 md:p-10">
				<header className="flex items-center gap-3">
					{/* The cook, looking up; held still for those who'd rather
					    nothing moved. */}
					<picture className="shrink-0">
						<source
							srcSet="/icon-192.png"
							media="(prefers-reduced-motion: reduce)"
						/>
						<img
							src="/chef-cat.png"
							alt=""
							width={310}
							height={320}
							className="h-16 w-auto [image-rendering:pixelated] md:h-24"
						/>
					</picture>
					{/* The cat says it: the day, then what it asks. Mid-shop, it
					    only says to finish. */}
					<div className="bg-card border-border before:bg-card before:border-border relative flex min-w-0 flex-col gap-0.5 rounded-xl border px-4 py-3 before:absolute before:top-1/2 before:-left-1.5 before:size-3 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l">
						{now.shopping && !now.cooking ? null : (
							<p className="text-muted-foreground text-sm font-semibold">
								it's {weekday.format(today).toLowerCase()}{' '}
								{partOfDay(today.getHours())},
							</p>
						)}
						<h1 className="text-xl font-bold md:text-3xl">{headline}</h1>
					</div>
				</header>
				{now.cooking ? (
					<StillCooking cooking={now.cooking} waiting={now.waiting} />
				) : now.shopping ? (
					<Shopping shopping={now.shopping} />
				) : null}
				<section aria-label="find a recipe" className="flex flex-col gap-3">
					<Finder filters={filters} onFilters={setFilters} />
				</section>
			</div>
		</main>
	)
}

// The recipe being cooked: the step it is on, the one after, and the way
// back to it.
function StillCooking({
	cooking,
	waiting,
}: {
	cooking: NonNullable<Now['cooking']>
	waiting: number
}) {
	const started = Math.max(1, cooking.minutesIn)

	return (
		<section aria-label="still cooking" className="flex flex-col gap-3">
			<div className="bg-kitchen-basil/10 border-kitchen-basil/35 flex flex-col gap-4 rounded-xl border p-4">
				<div className="flex items-center gap-3">
					<span className="bg-card grid size-14 shrink-0 place-items-center rounded-xl">
						<RecipeGlyph title={cooking.title} size={28} />
					</span>
					<span className="flex min-w-0 flex-col">
						<span className="truncate text-lg font-bold">{cooking.title}</span>
						<span className="text-muted-foreground text-sm font-semibold">
							step {cooking.on} of {cooking.steps} · started{' '}
							{started < 60
								? `${started} min ago`
								: `${Math.round(started / 60)} h ago`}
						</span>
					</span>
				</div>
				<Progress
					done={cooking.step === null ? cooking.steps : cooking.on - 1}
					of={cooking.steps}
				/>
				{cooking.step ? (
					<div className="flex flex-col gap-1.5">
						<p className="flex gap-2.5 text-base">
							<span className="font-bold tabular-nums">{cooking.on}</span>
							<span className="line-clamp-3">{cooking.step}</span>
						</p>
						{cooking.next ? (
							<p className="text-muted-foreground flex gap-2.5 text-sm">
								<span className="font-bold tabular-nums">{cooking.on + 1}</span>
								<span className="line-clamp-1">next: {cooking.next}</span>
							</p>
						) : null}
					</div>
				) : null}
				<Link
					to="/recipes/$recipeId"
					params={{ recipeId: cooking.recipeId }}
					className={buttonVariants({ className: 'min-h-12 text-base' })}
				>
					back to it
				</Link>
			</div>
			{waiting ? (
				<Link
					to="/kitchen/shop"
					className="border-border hover:border-foreground/30 flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-sm font-bold transition-colors"
				>
					{waiting} on your list
					<ArrowRightIcon size={14} weight="bold" aria-hidden />
				</Link>
			) : null}
		</section>
	)
}

// A shop under way, in one line: how far along, and the way to the list.
function Shopping({ shopping }: { shopping: NonNullable<Now['shopping']> }) {
	return (
		<Link
			to="/kitchen/shop"
			aria-label={`groceries: ${shopping.inCart} of ${shopping.total} in the cart`}
			className="bg-kitchen-yolk/15 border-kitchen-yolk/60 hover:border-kitchen-yolk flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
		>
			<ShoppingCartIcon
				size={18}
				weight="bold"
				aria-hidden
				className="shrink-0"
			/>
			<span className="shrink-0 text-sm font-bold tabular-nums">
				{shopping.inCart} of {shopping.total} in the cart
			</span>
			<Progress done={shopping.inCart} of={shopping.total} />
			<ArrowRightIcon
				size={14}
				weight="bold"
				aria-hidden
				className="shrink-0"
			/>
		</Link>
	)
}

// How far along, as a bar.
function Progress({ done, of }: { done: number; of: number }) {
	return (
		<progress
			value={done}
			max={Math.max(1, of)}
			className={cn(
				'h-2 w-full overflow-hidden rounded-full',
				'[&::-webkit-progress-bar]:bg-foreground/10 [&::-webkit-progress-value]:bg-kitchen-basil [&::-moz-progress-bar]:bg-kitchen-basil',
			)}
		/>
	)
}

// The search laid flat on the page: a recipe picked opens its own page.
function Finder({
	filters,
	onFilters,
}: {
	filters: FinderFilters
	onFilters: (filters: FinderFilters) => void
}) {
	const input = useRef<HTMLInputElement>(null)
	const { q } = Route.useSearch()

	return (
		<div className="bg-card border-border flex flex-col overflow-hidden rounded-xl border">
			<FinderPanel
				// A new search asked for starts the box over with its words.
				key={q ?? ''}
				inputRef={input}
				defaultQuery={q ?? ''}
				close={() => undefined}
				inline={{ filters, onFilters, focus: q !== undefined }}
			/>
		</div>
	)
}
