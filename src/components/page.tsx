import { ArrowLeftIcon } from '@phosphor-icons/react'
import { createLink, useCanGoBack, useRouter } from '@tanstack/react-router'
import * as React from 'react'

import { useScrollHidden } from '@/lib/use-scroll-reveal'
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
				'text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 items-center gap-1.5 md:self-start text-sm font-semibold',
				className,
			)}
			{...props}
		>
			<ArrowLeftIcon
				size={18}
				weight="bold"
				aria-hidden
				className="md:size-3.5"
			/>
			{/* On a phone the arrow says it; the words stay for a screen reader. */}
			<span className="max-md:sr-only">{children}</span>
		</a>
	)
})

export const BackLink = createLink(BackAnchor)

// The same way back, for one that opens something rather than going to a page.
export function BackButton({
	onClick,
	children,
}: {
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-muted-foreground hover:text-foreground inline-flex min-h-11 min-w-11 items-center gap-1.5 text-sm font-semibold md:self-start"
		>
			<ArrowLeftIcon
				size={18}
				weight="bold"
				aria-hidden
				className="md:size-3.5"
			/>
			{/* On a phone the arrow says it; the words stay for a screen reader. */}
			<span className="max-md:sr-only">{children}</span>
		</button>
	)
}

// The way back for a recipe opened from home's search: back through history
// when it came from there, so the search keeps its words, filters and place,
// or else to home asking the same thing again.
export function BackToSearch({ query }: { query: string }) {
	const router = useRouter()
	const canGoBack = useCanGoBack()

	return (
		<BackButton
			onClick={() => {
				if (canGoBack) router.history.back()
				else
					void router.navigate({ to: '/', search: query ? { q: query } : {} })
			}}
		>
			{query ? 'back to results' : 'back to home'}
		</BackButton>
	)
}

// The account, as the app's shell draws it, for a bar that stands in for the
// phone's header. Handed down rather than imported, so this module stays
// below the app's chrome.
export const BarAccount = React.createContext<React.ReactNode>(null)

// The way back on phones is a bar at the top, the same as the header it
// stands in for: it steps aside as the page scrolls down, and back on the
// way up. On desktop it is just the link above the title. It sits inside a page's padded
// <main>, so it pulls out to the edges.
export function BackBar({
	children,
	end,
}: {
	children: React.ReactNode
	// What the page offers, quietly, across from the way back.
	end?: React.ReactNode
}) {
	const hidden = useScrollHidden()
	const account = React.useContext(BarAccount)

	return (
		<div
			className={cn(
				'border-border bg-background sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-6 -mt-6 mb-4 flex min-h-14 items-center justify-between gap-3 border-b px-6 motion-safe:transition-transform md:static md:m-0 md:mb-2 md:min-h-0 md:border-0 md:p-0',
				hidden && 'max-md:-translate-y-full',
			)}
		>
			{children}
			<div className="flex items-center gap-2">
				{end ? <div className="flex items-center gap-1">{end}</div> : null}
				{/* A phone's header gives way to this bar, so the account comes
				    along; on desktop it lives in the sidebar. */}
				{account ? <div className="md:hidden">{account}</div> : null}
			</div>
		</div>
	)
}
