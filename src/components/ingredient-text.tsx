import { ingredientNameRange } from '@/lib/pantry/catalog'
import { cn } from '@/lib/utils/ui'

export function IngredientText({
	text,
	done = false,
}: {
	text: string
	done?: boolean
}) {
	const name = ingredientNameRange(text)

	return (
		<span
			className={cn(
				'block min-w-0 flex-1 text-base leading-relaxed font-normal wrap-break-word',
				done && 'text-muted-foreground line-through',
			)}
		>
			{name ? (
				<>
					{text.slice(0, name.start)}
					<strong className="font-semibold">
						{text.slice(name.start, name.end)}
					</strong>
					{text.slice(name.end)}
				</>
			) : (
				text
			)}
		</span>
	)
}
