import { hadItIn, type LineStatus } from '@/lib/pantry/status'
import { cn } from '@/lib/utils/ui'

// Each state in words on a very light tint, to scan by color and read by
// word: had (basil); on the list, or going on it as running low or extra
// (yolk, the color of anything picked); needed or not seen lately (paper).
const tones: Record<LineStatus['kind'], string> = {
	have: 'bg-kitchen-basil/15',
	low: 'bg-kitchen-yolk/30',
	list: 'bg-kitchen-yolk/30',
	stale: 'bg-foreground/5',
	need: 'bg-foreground/5',
}

function labelOf(status: LineStatus, listed: string) {
	switch (status.kind) {
		case 'have':
			return 'have it'
		case 'low':
			return 'running low'
		case 'list':
			return listed
		case 'stale':
			return hadItIn(status.since)
		case 'need':
			return 'need'
	}
}

// A line the kitchen has, ticked to buy anyway: yolk, as anything picked.
export function ExtraTag() {
	return <span className={cn(bubble, 'bg-kitchen-yolk/30')}>extra</span>
}

const bubble =
	'inline-flex shrink-0 items-center rounded-full px-2 text-xs leading-5 font-semibold whitespace-nowrap'

// What the kitchen says of a line. Needed, or not seen lately, is a dashed
// tap from "I have it" when `onHave` is given, for food bought without the
// app knowing.
export function KitchenTag({
	status,
	onHave,
	listed = 'on list',
	className,
}: {
	status: LineStatus | undefined
	onHave?: (() => void) | undefined
	listed?: string
	className?: string
}) {
	if (!status) return null

	const label = labelOf(status, listed)
	const tappable = onHave && (status.kind === 'need' || status.kind === 'stale')

	if (!tappable)
		return (
			<span className={cn(bubble, tones[status.kind], className)}>{label}</span>
		)

	return (
		<button
			type="button"
			title="tap if you have it"
			aria-label={`${label}: mark as have it`}
			onClick={(event) => {
				// Inside a row's label: the tap is for this, not the tick.
				event.preventDefault()
				onHave()
			}}
			className={cn(
				bubble,
				tones[status.kind],
				'border-foreground/25 hover:border-foreground/50 -my-px border border-dashed transition-colors',
				className,
			)}
		>
			{label}
		</button>
	)
}
