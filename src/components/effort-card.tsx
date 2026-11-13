import {
	ClockIcon,
	type Icon,
	MoonIcon,
	SnowflakeIcon,
	BowlFoodIcon,
} from '@phosphor-icons/react'

import { shortDuration } from '@/lib/recipes/duration'
import {
	effortLevel,
	type EffortLevel,
	effortPerMeal,
	type RecipeEffort,
} from '@/lib/recipes/effort'
import { cn } from '@/lib/utils/ui'

// Basil, yolk, tomato as a recipe asks more: the one scale DESIGN.md lets the
// three be a traffic light for.
export const effortTints = new Map<EffortLevel, { dot: string }>([
	['low', { dot: 'bg-kitchen-basil' }],
	['medium', { dot: 'bg-kitchen-yolk' }],
	['high', { dot: 'bg-kitchen-tomato' }],
])

// What a recipe asks of the cook, beside its photo under its title: its time
// and what it makes, and at its foot what kind of recipe it is. What to buy is the ingredients' to
// say.
export function EffortCard({
	effort,
	toBuy,
	tags,
}: {
	effort: RecipeEffort
	// What the reader's kitchen lacks of it, when the kitchen is known.
	toBuy?: readonly string[] | undefined
	// What kind of recipe it is, as the list's tags say it, at the card's foot.
	tags?: React.ReactNode
}) {
	const share = effortPerMeal(effort, toBuy?.length)
	const level = effortLevel(effort, toBuy?.length)
	const tint = level ? effortTints.get(level) : undefined

	if (!share) return null

	const hands = effort.activeMinutes ?? effort.totalMinutes ?? 0
	const waiting = effort.waitingMinutes ?? 0

	return (
		<section
			aria-label="what it takes"
			className="border-border mt-4 flex max-w-md flex-col gap-2.5 rounded-xl border px-3.5 py-3 lowercase"
		>
			<div className="grid grid-cols-2 gap-3 text-sm">
				<Part icon={ClockIcon}>
					<b>{shortDuration(effort.totalMinutes ?? hands + waiting)}</b>
					{waiting > 0 ? (
						<>
							<span>{shortDuration(hands)} hands on</span>
							<span>
								{shortDuration(waiting)}{' '}
								{effort.waits.slice(0, 2).join(', ') || 'waiting'}
							</span>
						</>
					) : (
						<span>all hands on</span>
					)}
				</Part>
				<Part icon={BowlFoodIcon}>
					<b>
						{share.meals} {share.meals === 1 ? 'meal' : 'meals'}
					</b>
					<span>keeps {effort.keeps.days}</span>
					{effort.keeps.freezes ? (
						<span className="inline-flex items-center gap-1">
							<SnowflakeIcon size={12} weight="bold" aria-hidden />
							freezes well
						</span>
					) : null}
				</Part>
			</div>
			{effort.dayBefore ? (
				<p className="flex items-center gap-1.5 text-sm font-semibold">
					<MoonIcon size={14} weight="bold" aria-hidden />
					start the day before
				</p>
			) : null}
			{tags || level ? (
				<div className="border-border flex flex-col gap-2 border-t pt-2.5">
					{tags}
					{/* The effort in a word, by its dot, last and quiet. */}
					{level && tint ? (
						<p className="inline-flex items-center gap-2 text-sm font-semibold">
							<span
								aria-hidden
								className={cn('size-2 rounded-full', tint.dot)}
							/>
							{level} effort
						</p>
					) : null}
				</div>
			) : null}
		</section>
	)
}

// One of the card's halves: its mark, then what it says, the first line in
// ink and the rest quieter.
function Part({
	icon: Mark,
	children,
}: {
	icon: Icon
	children: React.ReactNode
}) {
	return (
		<div className="flex gap-2">
			<Mark size={16} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
			<div className="text-muted-foreground [&>b]:text-foreground flex min-w-0 flex-col font-semibold">
				{children}
			</div>
		</div>
	)
}
