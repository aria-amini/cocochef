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
	large = false,
	className,
}: {
	title: string
	saved: boolean
	saving: boolean
	toggle: () => void
	// On a full photo: bigger, and set inside its corner rather than over it.
	large?: boolean
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
				'bg-card border-border absolute z-10 grid place-items-center rounded-full border shadow-md transition before:absolute before:-inset-1.5 hover:scale-110 active:scale-95',
				large ? 'top-3 left-3 size-11' : '-top-2 -left-2 size-8 md:size-9',
				saved
					? 'text-kitchen-eggplant border-kitchen-eggplant/40'
					: 'text-foreground hover:border-foreground/40',
				className,
			)}
		>
			{saving ? (
				<CircleNotchIcon
					size={large ? 20 : 16}
					weight="bold"
					aria-hidden
					className="animate-spin"
				/>
			) : (
				<BookmarkSimpleIcon
					size={large ? 20 : 16}
					weight={saved ? 'fill' : 'bold'}
					aria-hidden
				/>
			)}
		</button>
	)
}
