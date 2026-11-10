import { IngredientText } from '@/components/ingredient-text'
import { PantrySprite } from '@/components/pantry-sprite'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { splitIngredientAmount } from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

// An ingredient line set out like a printed card: the food's picture, the
// amount in its own column, then the food. A line with no amount ("salt to
// taste") leaves the column empty, so the foods still line up.
export function IngredientLineView({
	line,
	className,
	guess,
}: {
	line: string
	className?: string | undefined
	// Stands in the amount column of a line written without an amount, such as
	// a likely amount to take.
	guess?: React.ReactNode
}) {
	const { amount, name } = splitIngredientAmount(line)
	const look = ingredientItemLook(line)

	return (
		<span
			className={cn(
				'flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5',
				className,
			)}
		>
			<span
				aria-hidden
				className="flex size-6 shrink-0 items-center justify-center"
			>
				{look ? <PantrySprite look={look} className="size-6" /> : null}
			</span>
			<span className="w-20 shrink-0 leading-relaxed font-bold wrap-break-word tabular-nums">
				{amount || guess}
			</span>
			<IngredientText text={name} />
		</span>
	)
}
