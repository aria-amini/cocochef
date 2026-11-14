import { cn } from '@/lib/utils/ui'

// A skeleton keeps the corners of what it stands in for: a card, tile or
// photo; a line of text, a control or a row; or a photo filling a tile that
// already rounds it.
const corners = {
	card: 'rounded-xl',
	line: 'rounded-md',
	fill: 'rounded-none',
}

function Skeleton({
	kind = 'card',
	className,
	...props
}: React.ComponentProps<'div'> & { kind?: keyof typeof corners }) {
	return (
		<div
			data-slot="skeleton"
			className={cn('bg-muted animate-pulse', corners[kind], className)}
			{...props}
		/>
	)
}

export { Skeleton }
