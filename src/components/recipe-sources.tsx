import { recipeSites } from '@/lib/discover/sites'
import { importSiteLogo } from '@/lib/import/sites'
import { cn } from '@/lib/utils/ui'

// A few logos stand for the rest: four on a wide screen, three on a phone,
// then how many more.
const shown = 4

const phoneShown = 3

// The recipe sites a search reaches, as a quiet, overlapping row of round
// logos after the search box's words, named in full for screen readers. The
// row is muted as one, so the rings between logos read as cut-outs in the
// box rather than outlines.
export function RecipeSources({ className }: { className?: string }) {
	return (
		<span className={cn('flex shrink-0 items-center', className)}>
			<span className="sr-only">
				across {recipeSites.map((site) => site.name).join(', ')}
			</span>
			<span
				aria-hidden
				className="flex items-center -space-x-1 opacity-60 grayscale"
			>
				{recipeSites.slice(0, shown).map((site, at) => (
					<img
						key={site.id}
						data-site-logo={site.id}
						src={importSiteLogo(site.id)}
						alt=""
						className={cn(
							'bg-card ring-card size-4 rounded-full object-cover ring-2',
							at >= phoneShown && 'max-sm:hidden',
						)}
					/>
				))}
			</span>
			<span
				aria-hidden
				className="text-muted-foreground ml-1 text-xs font-semibold sm:hidden"
			>
				+{recipeSites.length - phoneShown}
			</span>
			{recipeSites.length > shown ? (
				<span
					aria-hidden
					className="text-muted-foreground ml-1 text-xs font-semibold max-sm:hidden"
				>
					+{recipeSites.length - shown}
				</span>
			) : null}
		</span>
	)
}
