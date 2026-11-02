import { useRender } from '@base-ui/react/use-render'

import { cn } from '@/lib/utils/ui'

// A small label that names a state ("work in progress", "soon"): paper, a
// hairline, 8px corners.
const badgeClassName =
	"border-border bg-background inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3"

function Badge({
	className,
	render,
	...props
}: useRender.ComponentProps<'span'>) {
	return useRender({
		defaultTagName: 'span',
		render,
		props: {
			'data-slot': 'badge',
			className: cn(badgeClassName, className),
			...props,
		},
	})
}

export { Badge }
