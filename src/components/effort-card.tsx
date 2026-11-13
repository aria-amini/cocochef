import {
	ClockIcon,
	type Icon,
	MoonIcon,
	SnowflakeIcon,
	BowlFoodIcon,
} from '@phosphor-icons/react'

import { shortDuration } from '@/lib/recipes/duration'
import { mealsOf, type RecipeEffort } from '@/lib/recipes/effort'

// Whether the card has anything to say: a time, or how many it serves.
export const effortShown = (effort: RecipeEffort) =>
	effort.totalMinutes !== undefined ||
	effort.activeMinutes !== undefined ||
	mealsOf(effort) !== undefined

// What a recipe asks of the cook, beside its photo under its title, as the
// facts a week of cooking is planned by: its time and how much of it is hands
// on, how many meals it makes, and how long they keep. At its foot, what kind
// of recipe it is.
export function EffortCard({
	effort,
	tags,
}: {
	effort: RecipeEffort
	// What kind of recipe it is, as the list's tags say it, at the card's foot.
	tags?: React.ReactNode
}) {
	if (!effortShown(effort)) return null

	const meals = mealsOf(effort)
	const hands = effort.activeMinutes ?? effort.totalMinutes
	const waiting = effort.waitingMinutes ?? 0

	return (
		<section
			aria-label="what it takes"
			className="border-border mt-4 flex max-w-md flex-col gap-2.5 rounded-xl border px-3.5 py-3 lowercase"
		>
			<div className="grid grid-cols-2 gap-3 text-sm">
				{hands === undefined ? null : (
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
				)}
				<Part icon={BowlFoodIcon}>
					{meals ? (
						<b>
							{meals} {meals === 1 ? 'meal' : 'meals'}
						</b>
					) : null}
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
			{tags ? (
				<div className="border-border flex flex-col gap-2 border-t pt-2.5">
					{tags}
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
