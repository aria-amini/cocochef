import { Minus, Plus, ShoppingCartIcon } from '@phosphor-icons/react'
import { useState } from 'react'

import {
	amountShown,
	CartStepper,
	withAmountSaid,
} from '@/components/recipe-shop'
import { Button } from '@/components/ui/button'
import { stepShopping } from '@/lib/groceries/amounts'
import type { PantryLevel } from '@/lib/pantry/model'
import { cn } from '@/lib/utils/ui'

type Need = 'low' | 'out' | 'extra'

// Why a kept food might be bought: it's low, it's out, or there's enough
// but more is wanted. None picked means there's enough. Low and out are the
// pantry's to say; extra is having it and listing it anyway, so picking it
// lists the food, and unpicking it takes it off.
export function PantryNeed({
	name,
	level,
	line,
	disabled = false,
	onLevel,
	onAdd,
	onStep,
	onTakeOff,
}: {
	name: string
	level: PantryLevel
	// The food's line waiting on the grocery list, if there is one.
	line: { id: string; text: string } | undefined
	disabled?: boolean
	onLevel: (level: PantryLevel) => void
	onAdd: (text: string) => void
	onStep: (line: { id: string; text: string }, by: 1 | -1) => void
	onTakeOff: (line: { id: string; text: string }) => void
}) {
	const [text, setText] = useState(() => withAmountSaid(name))
	const least = stepShopping(text, -1) === text

	const need: Need | undefined =
		level === 'low'
			? 'low'
			: level === 'out'
				? 'out'
				: line
					? 'extra'
					: undefined

	function pick(next: Need) {
		if (need === next) {
			if (next === 'extra') {
				if (line) onTakeOff(line)
			} else onLevel('plenty')

			return
		}

		if (next === 'extra') {
			if (level !== 'plenty') onLevel('plenty')

			if (!line) onAdd(text)
		} else onLevel(next)
	}

	return (
		<div className="flex flex-col gap-3">
			<fieldset className="border-input grid w-full grid-cols-3 overflow-hidden rounded-md border">
				<legend className="sr-only">need more?</legend>
				{(
					[
						{ need: 'low', label: 'low', picked: 'bg-kitchen-yolk/30' },
						{ need: 'out', label: 'out', picked: 'bg-kitchen-tomato/15' },
						{
							need: 'extra',
							label: 'want more',
							picked: 'bg-kitchen-basil/20',
						},
					] as const
				).map((option) => {
					const on = need === option.need

					return (
						<button
							key={option.need}
							type="button"
							aria-pressed={on}
							disabled={disabled}
							onClick={() => pick(option.need)}
							className={cn(
								'border-input flex min-h-11 items-center justify-center px-2 text-sm font-semibold transition-colors not-first:border-l disabled:opacity-60',
								on ? option.picked : 'hover:bg-muted/60',
							)}
						>
							{option.label}
						</button>
					)
				})}
			</fieldset>
			{line ? (
				// On the list: how much, changed right there.
				<div className="flex min-h-11 items-center gap-2">
					<ShoppingCartIcon
						size={16}
						weight="bold"
						aria-hidden
						className="text-muted-foreground"
					/>
					<span className="text-muted-foreground flex-1 text-sm font-semibold">
						on your list
					</span>
					<CartStepper
						name={name}
						text={line.text}
						disabled={disabled}
						onStep={(by) => onStep(line, by)}
						onTakeOff={() => onTakeOff(line)}
					/>
				</div>
			) : need ? (
				// Low or out: how much to get, and onto the list when asked.
				<div className="flex items-center gap-2">
					<div className="border-input flex min-h-11 flex-1 items-center justify-between rounded-md border px-1">
						<button
							type="button"
							aria-label={`less ${name}`}
							disabled={least}
							onClick={() => setText((now) => stepShopping(now, -1))}
							className="grid size-10 place-items-center rounded-full disabled:opacity-30"
						>
							<Minus size={16} weight="bold" aria-hidden />
						</button>
						<span aria-live="polite" className="font-bold tabular-nums">
							{amountShown(text)}
						</span>
						<button
							type="button"
							aria-label={`more ${name}`}
							onClick={() => setText((now) => stepShopping(now, 1))}
							className="grid size-10 place-items-center rounded-full"
						>
							<Plus size={16} weight="bold" aria-hidden />
						</button>
					</div>
					<Button
						disabled={disabled}
						onClick={() => onAdd(text)}
						className="min-h-11"
					>
						<ShoppingCartIcon weight="bold" aria-hidden />
						add to list
					</Button>
				</div>
			) : null}
		</div>
	)
}
