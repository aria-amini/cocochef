import { MinusIcon, Plus } from '@phosphor-icons/react'

import type { LineCompletion } from '@/components/ingredient-combobox'
import {
	amountOf,
	amountUnits,
	formatQuantity,
	parseIngredientLine,
	setAmountUnit,
	settledAmount,
	stepAmount,
} from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

// Suggestions finish the food's name in a whole ingredient line, with or
// without an amount: "salm" and "2 lb salm" both offer salmon. A line that
// starts with a number waits for a space to finish its amount, so "1" on its
// way to "12 g" offers nothing yet.
export const lineCompletion: LineCompletion = {
	query: (line) =>
		settledAmount(line) || !/^\s*\p{N}/u.test(line)
			? parseIngredientLine(line).name
			: '',
	// The name is the line's last words, however they were spaced; the amount
	// stays as typed.
	apply: (line, suggestion) => {
		const words = parseIngredientLine(line).name.split(/\s+/).filter(Boolean)
		const name = new RegExp(`(?:\\S+\\s*){${words.length}}$`)

		return line.replace(name, '') + suggestion
	},
}

// Quick changes to the amount of the line in use, under it: a step up or
// down in the unit's own sizes, and the unit itself. Each tap rewrites the
// line, so typing still works as before; a press keeps the caret in the line.
export function AmountBar({
	line,
	onChange,
}: {
	line: string
	onChange: (line: string) => void
}) {
	const amount = amountOf(line)

	const chip =
		'min-h-9 shrink-0 rounded-md px-2 text-sm font-bold transition-colors'

	return (
		<div
			role="toolbar"
			aria-label="amount"
			onPointerDown={(event) => event.preventDefault()}
			className="animate-in fade-in flex items-center gap-0.5 overflow-x-auto pr-2 pb-2 pl-2 duration-150 md:pl-9"
		>
			<span className="bg-background flex shrink-0 items-center rounded-md">
				<button
					type="button"
					aria-label="less"
					disabled={!amount}
					onClick={() => onChange(stepAmount(line, -1))}
					className="hover:bg-kitchen-yolk/40 grid size-9 place-items-center rounded-md disabled:opacity-30"
				>
					<MinusIcon size={14} weight="bold" aria-hidden />
				</button>
				<output className="min-w-10 text-center text-sm font-bold tabular-nums">
					{amount ? formatQuantity(amount.quantity) : '–'}
				</output>
				<button
					type="button"
					aria-label="more"
					onClick={() => onChange(stepAmount(line, 1))}
					className="hover:bg-kitchen-yolk/40 grid size-9 place-items-center rounded-md"
				>
					<Plus size={14} weight="bold" aria-hidden />
				</button>
			</span>
			{amountUnits.map((unit) => (
				<button
					key={unit}
					type="button"
					aria-pressed={amount?.unit === unit}
					onClick={() => onChange(setAmountUnit(line, unit))}
					className={cn(
						chip,
						amount?.unit === unit
							? 'bg-kitchen-yolk/60'
							: 'text-muted-foreground hover:text-foreground hover:bg-background',
					)}
				>
					{unit}
				</button>
			))}
		</div>
	)
}
