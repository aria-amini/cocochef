import { siteLogoForUrl } from '@/lib/import/sites'
import { cn } from '@/lib/utils/ui'

// The small logo of the site a recipe came from, or nothing when we have none.
export function SiteIcon({
	url,
	className,
}: {
	url: string | undefined
	className?: string
}) {
	const logo = siteLogoForUrl(url)

	return logo ? (
		<img
			src={logo}
			alt=""
			className={cn('size-4 shrink-0 object-contain', className)}
		/>
	) : null
}
