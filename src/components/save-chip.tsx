import { BookmarkSimpleIcon, CircleNotchIcon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

// Keeps a recipe, or takes it back off, from wherever it is shown: a
// bookmark on its picture's corner that fills once it is kept. Raised off the
// picture, with a border and shadow, so it reads as something to press; its
// tap reaches a little past the chip.
export function SaveChip({
	title,
	saved,
	saving,
	toggle,
	className,
}: {
	title: string
	saved: boolean
	saving: boolean
	toggle: () => void
	className?: string | undefined
}) {
	return (
		<button
			type="button"
			aria-label={saved ? `unsave ${title}` : `save ${title}`}
			aria-pressed={saved}
			disabled={saving}
			// What it sits on opens the recipe; this only keeps it.
			onMouseDown={(event) => event.preventDefault()}
			onClick={(event) => {
				event.preventDefault()
				event.stopPropagation()
				toggle()
			}}
			className={cn(
				'bg-card border-border absolute -top-2 -left-2 z-10 grid size-8 place-items-center rounded-full border shadow-md transition before:absolute before:-inset-1.5 hover:scale-110 active:scale-95 md:size-9',
				saved
					? 'text-kitchen-eggplant border-kitchen-eggplant/40'
					: 'text-foreground hover:border-foreground/40',
				className,
			)}
		>
			{saving ? (
				<CircleNotchIcon
					size={16}
					weight="bold"
					aria-hidden
					className="animate-spin"
				/>
			) : (
				<BookmarkSimpleIcon
					size={16}
					weight={saved ? 'fill' : 'bold'}
					aria-hidden
				/>
			)}
		</button>
	)
}
