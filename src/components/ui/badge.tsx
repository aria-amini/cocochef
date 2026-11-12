import { useRender } from '@base-ui/react/use-render'

import { cn } from '@/lib/utils/ui'

// A small label that names a state ("work in progress", "soon"): paper, a
// hairline, 8px corners.
const badgeClassName =
	"border-border bg-background inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border text-xs font-semibold whitespace-nowrap [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3"

// `small` tucks onto the edge of another control ("beta" on a button).
const badgeSizes = {
	default: 'px-2.5 py-0.5',
	small: 'px-1 py-0 leading-4',
}

// `beta` marks what is still settling in, apart from the purple that marks
// the assistant itself.
const badgeTones = {
	default: '',
	beta: 'border-kitchen-tomato/40 text-kitchen-tomato',
}

function Badge({
	className,
	render,
	size = 'default',
	tone = 'default',
	...props
}: useRender.ComponentProps<'span'> & {
	size?: keyof typeof badgeSizes
	tone?: keyof typeof badgeTones
}) {
	return useRender({
		defaultTagName: 'span',
		render,
		props: {
			'data-slot': 'badge',
			className: cn(
				badgeClassName,
				badgeSizes[size],
				badgeTones[tone],
				className,
			),
			...props,
		},
	})
}

export { Badge }
