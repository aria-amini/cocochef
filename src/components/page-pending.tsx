import { BackBar } from '@/components/page'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/ui'

// A loading page: the column a page lays out in, said to be loading. Each
// page fills it with its own shape, so what loads lands where it was drawn.
export function PendingPage({
	className,
	children,
}: {
	className?: string
	children: React.ReactNode
}) {
	return (
		<main className="min-w-0 flex-1">
			<output className={cn('flex flex-col', className)}>
				<span className="sr-only">loading…</span>
				{children}
			</output>
		</main>
	)
}

// Stands in for a route whose loader is still running, so a slow navigation
// reads as loading instead of a frozen page followed by a flash.
export function PagePending() {
	return (
		<PendingPage className="max-w-2xl gap-6 p-6 md:p-10">
			<Skeleton kind="line" className="h-9 w-48" />
			<div className="flex flex-col gap-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		</PendingPage>
	)
}

// A recipe on its way, drawn like the reader: the way back, the photo beside
// the name, then ingredients beside the steps.
export function RecipePending() {
	return (
		<PendingPage className="p-6 md:p-10">
			<div className="max-w-5xl">
				<BackBar>
					<div className="flex min-h-11 items-center">
						<Skeleton kind="line" className="h-4 w-36" />
					</div>
				</BackBar>
				<div className="@container">
					<div className="flex flex-col gap-4 @xl:flex-row @xl:items-start @xl:gap-6">
						<Skeleton className="aspect-[4/3] w-full shrink-0 @xl:w-72" />
						<div className="flex min-w-0 flex-1 flex-col gap-3">
							<Skeleton kind="line" className="h-8 w-3/4 md:h-10" />
							<Skeleton kind="line" className="h-4 w-40" />
							<Skeleton className="mt-1 h-28 w-full max-w-sm" />
						</div>
					</div>
					<Skeleton kind="line" className="mt-6 h-10 w-44" />
					<div className="mt-8 grid gap-10 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @2xl:items-start @2xl:gap-12">
						<div className="flex flex-col gap-3">
							<div className="flex min-h-11 items-center">
								<Skeleton kind="line" className="h-6 w-28" />
							</div>
							{Array.from({ length: 6 }, (_, i) => (
								<Skeleton key={i} kind="line" className="h-9 w-full" />
							))}
						</div>
						<div className="flex flex-col gap-3">
							<div className="flex min-h-11 items-center">
								<Skeleton kind="line" className="h-6 w-20" />
							</div>
							{Array.from({ length: 4 }, (_, i) => (
								<Skeleton key={i} kind="line" className="h-12 w-full" />
							))}
						</div>
					</div>
				</div>
			</div>
		</PendingPage>
	)
}

// Quick loads never show it (300ms), and once it shows it stays long enough
// (400ms) not to flash. Pages start loading at the touch, so most are ready
// within 300ms, and until then the progress bar and the pulsing tab say the
// tap was heard; a skeleton any sooner flashed on pages waiting only on code.
export const pendingOptions = {
	defaultPendingComponent: PagePending,
	defaultPendingMs: 300,
	defaultPendingMinMs: 400,
}
