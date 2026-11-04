import { ArrowLeftIcon } from '@phosphor-icons/react'
import { createLink } from '@tanstack/react-router'
import * as React from 'react'

import { cn } from '@/lib/utils/ui'

// The one page heading: plain, lowercase, large, and balanced when it wraps.
export function PageTitle({
	as: Heading = 'h1',
	className,
	children,
	...props
}: React.ComponentProps<'h1'> & { as?: 'h1' | 'h2' }) {
	return (
		<Heading
			className={cn(
				'text-4xl leading-tight font-bold tracking-tight text-balance break-words md:text-5xl',
				className,
			)}
			{...props}
		>
			{children}
		</Heading>
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
				'text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold ',
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

// The way back on phones is a bar that stays put while the page scrolls; on
// desktop it is just the link above the title. It sits inside a page's padded
// <main>, so it pulls out to the edges.
export function BackBar({ children }: { children: React.ReactNode }) {
	return (
		<div className="border-border bg-background sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-6 -mt-6 mb-4 border-b px-6 md:static md:m-0 md:mb-2 md:border-0 md:p-0">
			{children}
		</div>
	)
}
