import type { CSSProperties } from 'react'

import type { Readiness } from '@/lib/pantry/readiness'
import { cn } from '@/lib/utils/ui'

const kinds = {
	// Along a tile's edge, end to end.
	edge: 'absolute inset-x-0',
	// On its own line, as a recipe's page shows it.
	track: 'overflow-hidden rounded-full',
} as const

// How ready a recipe is to cook, seen before it's read: basil for what's
// home, then yolk for what's on the list for it. What's left of the track is
// still to get.
export function ReadyBar({
	ready,
	kind,
	className,
}: {
	ready: Readiness
	kind: keyof typeof kinds
	className?: string
}) {
	const vars: CSSProperties & Record<`--${string}`, string> = {
		'--home': `${(ready.home / ready.total) * 100}%`,
		'--listed': `${(ready.listed / ready.total) * 100}%`,
	}

	return (
		<span
			aria-hidden
			style={vars}
			className={cn('bg-foreground/15 flex h-1.5', kinds[kind], className)}
		>
			<span className="bg-kitchen-basil w-(--home)" />
			<span className="bg-kitchen-yolk w-(--listed)" />
		</span>
	)
}
