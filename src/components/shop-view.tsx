import { CheckIcon } from '@phosphor-icons/react'

import { AddToGroceries } from '@/components/grocery-send'
import { PantrySprite } from '@/components/pantry-sprite'
import { usePantry, useWaitingGroceries } from '@/components/use-pantry'
import { findInPantry } from '@/lib/pantry/foods'
import { spotOf } from '@/lib/pantry/spots'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { lineStatus, type LineStatus } from '@/lib/pantry/status'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import {
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

// Where a recipe's food comes from, in the order a cook checks: what is
// fresh and bought for the meal, the dairy, the cupboard, the freezer, and
// the spices, which are rarely bought.
const shelves = [
	{ id: 'fresh', label: 'fresh' },
	{ id: 'dairy', label: 'dairy' },
	{ id: 'pantry', label: 'pantry' },
	{ id: 'frozen', label: 'frozen' },
	{ id: 'spices', label: 'spices' },
] as const

type ShelfId = (typeof shelves)[number]['id']

function shelfOf(line: string): ShelfId {
	const category = ingredientCategory(line)

	if (category === 'dairy') return 'dairy'

	if (category === 'spices') return 'spices'

	const spot = spotOf({ name: ingredientSubject(line), category })

	return spot === 'fridge' || spot === 'counter'
		? 'fresh'
		: spot === 'freezer'
			? 'frozen'
			: 'pantry'
}

// Food that spoils within this many days is worth using first.
const soonDays = 3

// A recipe read for the shop: how much of it is home, what it needs, and its
// lines by where they come from, each saying whether the kitchen has it. The
// spices, rarely bought, sit on one line.
export function ShopView({
	recipeId,
	title,
	lines,
}: {
	recipeId: string
	title: string
	lines: string[]
}) {
	const pantry = usePantry(true).data ?? []
	const waiting = useWaitingGroceries(true).data ?? []
	// Without a pantry or a list, "need" on every line says nothing.
	const knows = pantry.length > 0 || waiting.length > 0

	const food = lines.filter(
		(line) => line.trim() && ingredientHeading(line) === undefined,
	)

	const marked = food.map((line) => {
		const kept = findInPantry(line, pantry)

		return {
			line,
			shelf: shelfOf(line),
			status: lineStatus(line, pantry, waiting),
			going:
				kept &&
				kept.spoils &&
				kept.level !== 'out' &&
				kept.daysLeft <= soonDays,
		}
	})

	const counted = marked.filter((entry) => entry.status)

	const have = counted.filter(
		(entry) => entry.status?.kind === 'have' || entry.status?.kind === 'low',
	)

	const need = counted.filter(
		(entry) => entry.status?.kind === 'need' || entry.status?.kind === 'stale',
	)

	const using = marked.filter((entry) => entry.going)

	return (
		<div className="flex flex-col gap-5">
			{knows && counted.length ? (
				<div className="border-border flex flex-col gap-2 rounded-xl border p-3">
					<p className="text-base font-bold tabular-nums">
						{need.length
							? `you have ${have.length} of ${counted.length} · need ${need.length}`
							: `you have all ${counted.length}`}
					</p>
					{need.length || using.length ? (
						<p className="text-muted-foreground text-sm font-semibold">
							{[
								need.length
									? `need ${need.map((entry) => ingredientSubject(entry.line)).join(', ')}`
									: '',
								using.length
									? `uses your ${using.map((entry) => ingredientSubject(entry.line)).join(', ')} before it goes`
									: '',
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
					) : null}
					<div>
						<AddToGroceries recipeId={recipeId} title={title} lines={lines} />
					</div>
				</div>
			) : null}
			{shelves.map((shelf) => {
				const here = marked.filter((entry) => entry.shelf === shelf.id)

				if (!here.length) return null

				if (shelf.id === 'spices') {
					const missing = here.filter(
						(entry) =>
							entry.status?.kind === 'need' || entry.status?.kind === 'stale',
					)

					return (
						<section
							key={shelf.id}
							aria-label="spices"
							className="flex flex-col gap-1.5"
						>
							<h3 className="text-muted-foreground text-xs font-bold">
								spices
								{knows && !missing.length ? ' · all home' : ''}
							</h3>
							<p className="text-sm">
								{here.map((entry, index) => (
									<span key={entry.line}>
										{index ? (
											<span className="text-muted-foreground"> · </span>
										) : null}
										<span
											className={cn(
												knows && missing.includes(entry)
													? 'font-bold'
													: 'text-muted-foreground',
											)}
										>
											{ingredientSubject(entry.line)}
											{knows && missing.includes(entry) ? ' (need)' : ''}
										</span>
									</span>
								))}
							</p>
						</section>
					)
				}

				return (
					<section
						key={shelf.id}
						aria-label={shelf.label}
						className="flex flex-col"
					>
						<h3 className="text-muted-foreground pb-1 text-xs font-bold">
							{shelf.label}
						</h3>
						<ul className="divide-border divide-y">
							{here.map((entry) => {
								const look = ingredientItemLook(entry.line)

								return (
									<li
										key={entry.line}
										className="flex min-h-10 items-center gap-2.5 py-1"
									>
										<span
											aria-hidden
											className="grid size-6 shrink-0 place-items-center"
										>
											{look ? (
												<PantrySprite look={look} className="size-6" />
											) : null}
										</span>
										<span className="min-w-0 flex-1 text-base">
											{entry.line}
										</span>
										{knows ? (
											<Mark status={entry.status} going={!!entry.going} />
										) : null}
									</li>
								)
							})}
						</ul>
					</section>
				)
			})}
		</div>
	)
}

// Whether the kitchen has a line, quietly: what is had fades back, what is
// needed stands out.
function Mark({
	status,
	going,
}: {
	status: LineStatus | undefined
	going: boolean
}) {
	if (!status) return null

	const mark = 'inline-flex shrink-0 items-center gap-1 text-xs font-bold'

	if (going) return <span className={mark}>use soon</span>

	switch (status.kind) {
		case 'have':
			return (
				<span className={cn(mark, 'text-muted-foreground')}>
					<CheckIcon size={11} weight="bold" aria-hidden />
					have
				</span>
			)
		case 'low':
			return <span className={cn(mark, 'text-muted-foreground')}>low</span>
		case 'list':
			return (
				<span className={cn(mark, 'text-muted-foreground')}>on your list</span>
			)
		default:
			return (
				<span
					className={cn(
						mark,
						'border-foreground/40 rounded-full border px-2 leading-5',
					)}
				>
					need
				</span>
			)
	}
}
