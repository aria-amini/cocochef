import {
	abbreviateUnits,
	splitIngredientDetails,
} from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

export function IngredientText({
	text,
	done = false,
}: {
	text: string
	done?: boolean
}) {
	const display = abbreviateUnits(text)
		.replace(/\(\s*,\s*/g, '(')
		.replace(/\(\(([^()]*)\)([^()]*)\)/g, '($1$2)')

	const { main, detail } = splitIngredientDetails(display)

	return (
		<span
			className={cn(
				'block min-w-0 flex-1 text-base leading-relaxed font-normal wrap-break-word',
				done && 'text-muted-foreground line-through',
			)}
		>
			{main}
			{detail ? (
				<span className="text-muted-foreground block text-sm leading-normal">
					{' '}
					{detail}
				</span>
			) : null}
		</span>
	)
}
