import { shortDuration } from '@/lib/recipes/duration'
import { mealsOf, type RecipeEffort } from '@/lib/recipes/effort'

// What a recipe asks and what others made of it, under its title, as up to
// three numbers with the detail under each, quieter: its time and how much
// of it is hands on, how many meals and how long they keep, and its rating
// with the page it came from. No box: the numbers carry it.
export function RecipeFacts({
	effort,
	rating,
	from,
}: {
	effort: RecipeEffort
	// The stars, from the page it came from.
	rating?: React.ReactNode
	// Where it came from: the page, its comments, any other links.
	from?: React.ReactNode
}) {
	const meals = mealsOf(effort)
	const hands = effort.activeMinutes ?? effort.totalMinutes
	const waiting = effort.waitingMinutes ?? 0

	const facts = [
		hands === undefined ? null : (
			<Fact
				key="time"
				head={shortDuration(effort.totalMinutes ?? hands + waiting)}
			>
				{waiting > 0 ? `${shortDuration(hands)} hands on` : 'all hands on'}
			</Fact>
		),
		meals ? (
			<Fact key="meals" head={`${meals} ${meals === 1 ? 'meal' : 'meals'}`}>
				keeps {effort.keeps.days}
				{effort.keeps.freezes ? <span>freezes well</span> : null}
			</Fact>
		) : null,
		rating ? (
			<Fact key="rating" head={rating}>
				{from}
			</Fact>
		) : null,
	].filter((fact) => fact !== null)

	if (!facts.length && !from) return null

	return (
		<section aria-label="what it takes" className="mt-4 flex flex-col gap-3">
			{facts.length ? (
				<div className="flex flex-wrap gap-x-4 gap-y-3 sm:gap-x-8">{facts}</div>
			) : null}
			{effort.dayBefore ? (
				<p className="text-muted-foreground text-sm font-semibold">
					start the day before
				</p>
			) : null}
			{/* Unrated, where it came from has a line of its own. */}
			{rating ? null : from ? (
				<div className="text-muted-foreground text-sm font-semibold">
					{from}
				</div>
			) : null}
		</section>
	)
}

// One number, in ink, and what it means, quieter under it.
function Fact({
	head,
	children,
}: {
	head: React.ReactNode
	children?: React.ReactNode
}) {
	return (
		// The time and the meals keep their width; the rating takes what's left,
		// or, beside a thumbnail with too little left, a row of its own.
		<div className="flex min-w-0 flex-col whitespace-nowrap not-last:shrink-0 last:min-w-24 last:flex-1">
			<span className="truncate text-base font-bold tabular-nums">{head}</span>
			<span className="text-muted-foreground flex min-w-0 flex-col text-xs font-semibold *:truncate sm:text-sm">
				{children}
			</span>
		</div>
	)
}
