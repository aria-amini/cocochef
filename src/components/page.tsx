import { ArrowLeftIcon } from '@phosphor-icons/react'
import { createLink } from '@tanstack/react-router'
import * as React from 'react'

import { cn } from '@/lib/utils/ui'

// The one page heading: plain, lowercase, large, and balanced when it wraps.
export function PageTitle({
	className,
	children,
	...props
}: React.ComponentProps<'h1'>) {
	return (
		<h1
			className={cn(
				'text-4xl leading-tight font-bold tracking-tight text-balance break-words md:text-5xl',
				className,
			)}
			{...props}
		>
			{children}
		</h1>
	)
}

// The way back up, above a page's title: muted until hovered, and tall enough
// to hit with a thumb.
const BackAnchor = React.forwardRef<
	HTMLAnchorElement,
	React.AnchorHTMLAttributes<HTMLAnchorElement>
>(function BackAnchor({ className, children, ...props }, ref) {
	return (
		<a
			ref={ref}
			className={cn(
				'text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2',
				className,
			)}
			{...props}
		>
			<ArrowLeftIcon size={14} weight="bold" aria-hidden />
			{children}
		</a>
	)
})

export const BackLink = createLink(BackAnchor)
