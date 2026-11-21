import { CheckIcon, TrashIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AnyLeft, useCookDone } from '@/components/recipe-cook'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { RecipeMenu } from '@/components/recipe-menu'
import { ReadinessMark, readinessOf } from '@/components/recipe-ready'
import { useRecipeShop } from '@/components/recipe-shop'
import { Button } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { useInProgress, usePlanWrites } from '@/components/use-plans'
import { sizedPhoto } from '@/lib/photos/sized'
import { tileColorFor, tileColors } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'

type Planned = NonNullable<ReturnType<typeof useInProgress>['data']>[number]

// In progress this long, a recipe is asked about rather than kept on.
const askAfter = 14 * 86_400_000

const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

// The recipes being shopped for and still to cook: on from the first food
// sent to the list, off once cooked. Each says how far along its shop is.
export function InProgress() {
	const recipes = useInProgress(true)
	const headingId = useId()

	if (!recipes.data?.length) return null

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2
				id={headingId}
				className="flex items-baseline justify-between text-lg font-semibold"
			>
				in progress
				<span className="text-muted-foreground text-sm font-bold tabular-nums">
					{recipes.data.length}
				</span>
			</h2>
			<ul className="bg-card border-border flex flex-col rounded-xl border px-4">
				{recipes.data.map((planned) => (
					<InProgressRow key={planned.recipeId} planned={planned} />
				))}
			</ul>
		</section>
	)
}

// What's skipped, said short: one or two by name, more as a count.
function skippingLine(names: readonly string[]) {
	if (names.length > 2) return `skipping ${names.length} foods`

	return `skipping ${names.join(' and ')}`
}

function InProgressRow({ planned }: { planned: Planned }) {
	const row = useRef<HTMLLIElement>(null)
	const shop = useRecipeShop(planned.recipeId, planned.ingredients)
	const plans = usePlanWrites()
	const done = useCookDone(planned.recipeId, shop)
	const skips = new Set(planned.skipped)
	const readiness = readinessOf(shop.rows, skips)

	const skipping = shop.rows.flatMap((row) =>
		skips.has(row.line) ? [row.name] : [],
	)

	// The clock, read once: a day's drift doesn't matter here.
	const [now] = useState(() => Date.now())
	const old = now - planned.plannedAt.getTime() > askAfter

	function keep() {
		void plans.plan(planned.recipeId, planned.skipped).catch(() => {
			toast.error("couldn't save that — try again")
		})
	}

	async function drop() {
		try {
			await plans.drop(planned.recipeId)
			undoToast(
				`removed ${planned.title}`,
				() =>
					void plans
						.restore(planned.recipeId, planned)
						.catch(() => toast.error("couldn't undo that — try again")),
				'in-progress',
			)
		} catch {
			toast.error("couldn't save that — try again")
		}
	}

	return (
		<li
			ref={row}
			className="border-border flex flex-col gap-3 border-b py-3 last:border-0"
		>
			<div className="flex items-center gap-2">
				<Link
					to="/recipes/$recipeId"
					params={{ recipeId: planned.recipeId }}
					className="flex min-w-0 flex-1 items-center gap-3"
				>
					{planned.imageUrl ? (
						<img
							src={sizedPhoto(planned.imageUrl, 400)}
							alt=""
							className="border-border size-14 shrink-0 rounded-xl border object-cover"
						/>
					) : (
						<span
							aria-hidden
							className={cn(
								'border-border grid size-14 shrink-0 place-items-center rounded-xl border',
								tileColors[tileColorFor(planned.recipeId)],
							)}
						>
							<RecipeGlyph title={planned.title} size={26} />
						</span>
					)}
					<span className="flex min-w-0 flex-col gap-1">
						<span className="truncate font-bold">{planned.title}</span>
						{shop.known ? (
							<ReadinessMark state={readiness.state} label={readiness.label} />
						) : null}
						{skipping.length ? (
							<span className="text-muted-foreground text-xs font-semibold">
								{skippingLine(skipping)}
							</span>
						) : null}
					</span>
				</Link>
				{/* Cooked, or not happening: either, without opening it. */}
				<RecipeMenu
					label={`${planned.title} options`}
					size="size-10"
					items={[
						{
							key: 'done',
							label: 'done cooking',
							icon: CheckIcon,
							onSelect: done.start,
						},
						{
							key: 'remove',
							label: 'remove',
							icon: TrashIcon,
							onSelect: () => void drop(),
						},
					]}
				/>
			</div>
			{old ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="flex-1 text-sm font-semibold whitespace-nowrap">
						still making it?{' '}
						<span className="text-muted-foreground">
							started {day.format(planned.plannedAt).toLowerCase()}
						</span>
					</span>
					<span className="flex gap-2">
						<Button variant="outline" onClick={keep}>
							yes
						</Button>
						<Button variant="outline" onClick={() => void drop()}>
							no, remove it
						</Button>
					</span>
				</div>
			) : null}
			{done.asking ? (
				<AnyLeft
					anchor={() => row.current}
					fresh={done.fresh}
					onClose={done.stopAsking}
					onDone={(usedUp) => void done.finish(usedUp)}
				/>
			) : null}
		</li>
	)
}
