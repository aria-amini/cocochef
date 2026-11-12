import { StarIcon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

const compact = new Intl.NumberFormat('en', { notation: 'compact' })

// "1.2k" rather than "1,204", where space is short.
export const compactCount = (count: number) =>
	compact.format(count).toLowerCase()

// How a recipe's readers rated it on the page it came from: the stars and how
// many gave them, named in full for a screen reader. In a column, the count
// keeps a fixed width and digits an even one, so a list of ratings lines up.
export function RecipeRating({
	rating,
	column = false,
	className,
}: {
	rating: { value: number; count: number }
	column?: boolean
	className?: string
}) {
	return (
		<span
			aria-label={`rated ${rating.value.toFixed(1)} by ${rating.count}`}
			className={cn(
				'text-foreground inline-flex items-center gap-1 tabular-nums',
				className,
			)}
		>
			<StarIcon
				size={12}
				weight="fill"
				className="text-kitchen-yolk"
				aria-hidden
			/>
			{rating.value.toFixed(1)}
			<span className={cn('text-muted-foreground', column && 'w-[6ch]')}>
				({compactCount(rating.count)})
			</span>
		</span>
	)
}
