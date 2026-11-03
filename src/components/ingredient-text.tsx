import { ingredientNameRange } from '@/lib/pantry/catalog'
import { cn } from '@/lib/utils/ui'

export function IngredientText({
	text,
	done = false,
}: {
	text: string
	done?: boolean
}) {
	const display = text
		.replace(/\(\s*,\s*/g, '(')
		.replace(/\(\(([^()]*)\)([^()]*)\)/g, '($1$2)')

	const name = ingredientNameRange(display)

	return (
		<span
			className={cn(
				'block min-w-0 flex-1 text-base leading-relaxed font-normal wrap-break-word',
				done && 'text-muted-foreground line-through',
			)}
		>
			{name ? (
				<>
					{display.slice(0, name.start)}
					<strong className="font-semibold">
						{display.slice(name.start, name.end)}
					</strong>
					{display.slice(name.end)}
				</>
			) : (
				display
			)}
		</span>
	)
}
