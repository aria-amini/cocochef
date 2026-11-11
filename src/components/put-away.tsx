import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { foodOf } from '@/lib/pantry/foods'
import type { PantryCategory } from '@/lib/pantry/model'
import { restockPantry } from '@/lib/pantry/server'
import { cn } from '@/lib/utils/ui'

type Bought = {
	id: string
	text: string
	category: PantryCategory
	recipeTitle: string | null
}

// Shopping done: what was bought goes into the pantry, dated today, before
// the cart empties. All of it starts ticked; food bought for one recipe says
// which, and leaves the pantry once its few days are up.
export function PutAway({
	items,
	onClear,
	onClose,
}: {
	items: Bought[]
	onClear: () => void
	onClose: () => void
}) {
	const navigate = useNavigate()
	const client = useQueryClient()
	const [saving, setSaving] = useState(false)
	const [ticks, setTicks] = useState<Record<string, boolean>>({})

	// Everything bought starts ticked: food for one meal leaves the pantry on
	// its own once its days are up.
	const ticked = (item: Bought) => ticks[item.id] ?? true

	const chosen = items.filter(ticked)

	async function finish() {
		setSaving(true)

		try {
			if (chosen.length) {
				await restockPantry({
					data: chosen.map(({ text, category }) => ({ text, category })),
				})
				void client.invalidateQueries({ queryKey: ['pantry'] })
				toast.success(`put ${chosen.length} away in ingredients`, {
					action: {
						label: 'open',
						onClick: () => void navigate({ to: '/ingredients' }),
					},
				})
			}

			onClear()
			onClose()
		} catch {
			toast.error("couldn't put that away — try again")
		} finally {
			setSaving(false)
		}
	}

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="flex flex-col">
				<DialogHeader className="mx-8 text-center">
					<DialogTitle>put away</DialogTitle>
				</DialogHeader>
				<p
					aria-live="polite"
					className="text-muted-foreground -mb-3 text-sm font-semibold"
				>
					{chosen.length} of {items.length} into your ingredients
				</p>
				<ul
					aria-label="bought"
					className="divide-border border-border scrollbar-visible max-h-[55dvh] divide-y overflow-y-auto border-y"
				>
					{items.map((item) => {
						const on = ticked(item)
						const forOne = !foodOf(item.text)?.staple && item.recipeTitle

						return (
							<li key={item.id}>
								<label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
									<input
										type="checkbox"
										checked={on}
										onChange={(event) =>
											setTicks((now) => ({
												...now,
												[item.id]: event.target.checked,
											}))
										}
										className="accent-kitchen-basil size-5 shrink-0"
									/>
									<span
										className={cn(
											'min-w-0 flex-1 text-base',
											!on && 'text-muted-foreground',
										)}
									>
										{item.text}
									</span>
									{forOne ? (
										<span className="text-muted-foreground max-w-[45%] shrink-0 truncate text-xs font-semibold">
											for {forOne}
										</span>
									) : null}
								</label>
							</li>
						)
					})}
				</ul>
				<DialogFooter>
					<button
						type="button"
						disabled={saving}
						onClick={() => void finish()}
						className={buttonVariants()}
					>
						{saving
							? 'putting away…'
							: chosen.length
								? `put away ${chosen.length} and clear`
								: 'just clear the cart'}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
