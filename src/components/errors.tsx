import * as Sentry from '@sentry/tanstackstart-react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'

import { PageTitle } from '@/components/page'
import { Button, buttonVariants } from '@/components/ui/button'

// A missing or broken page: one sprite, one plain line, a way back.
function ErrorPage({
	sprite,
	title,
	children,
	actions,
}: {
	sprite: string
	title: string
	children: React.ReactNode
	actions: React.ReactNode
}) {
	return (
		<main className="flex flex-1 flex-col items-start gap-5 p-6 md:p-10">
			<img
				src={`/sprites/pantry/${sprite}.png`}
				alt=""
				className="size-12 [image-rendering:pixelated]"
			/>
			<PageTitle>{title}</PageTitle>
			<p className="text-muted-foreground max-w-md">{children}</p>
			<div className="flex flex-wrap gap-3">{actions}</div>
		</main>
	)
}

export function NotFoundComponent() {
	return (
		<ErrorPage
			sprite="egg"
			title="nothing on this shelf"
			actions={
				<Link to="/" className={buttonVariants()}>
					back to the kitchen
				</Link>
			}
		>
			this page isn&apos;t here. it may have moved, or the link is off by a
			letter.
		</ErrorPage>
	)
}

export function ServerErrorComponent({ error, reset }: ErrorComponentProps) {
	useEffect(() => {
		Sentry.captureException(error)
	}, [error])

	return (
		<ErrorPage
			sprite="fallback-other"
			title="something boiled over"
			actions={
				<>
					<Button type="button" onClick={reset}>
						try again
					</Button>
					<Link to="/" className={buttonVariants({ variant: 'outline' })}>
						back to the kitchen
					</Link>
				</>
			}
		>
			we couldn&apos;t load this page. try again, or head back and pick up where
			you left off.
		</ErrorPage>
	)
}
