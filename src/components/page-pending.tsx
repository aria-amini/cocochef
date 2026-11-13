import { Skeleton } from '@/components/ui/skeleton'

// Stands in for a route whose loader is still running, so a slow navigation
// reads as loading instead of a frozen page followed by a flash.
export function PagePending() {
	return (
		<main className="flex-1">
			<output className="flex max-w-2xl flex-col gap-6 p-6 md:p-10">
				<span className="sr-only">loading…</span>
				<Skeleton className="h-9 w-48" />
				<div className="flex flex-col gap-3">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</output>
		</main>
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
