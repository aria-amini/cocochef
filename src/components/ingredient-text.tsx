import { cn } from '@/lib/utils/ui'

export function IngredientText({
	text,
	done = false,
}: {
	text: string
	done?: boolean
}) {
	return (
		<span
			className={cn(
				'block min-w-0 flex-1 text-base leading-relaxed font-normal wrap-break-word',
				done && 'text-muted-foreground line-through',
			)}
		>
			{text}
		</span>
	)
}
