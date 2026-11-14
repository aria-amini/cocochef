import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { findInPantry } from '@/lib/pantry/foods'
import { count } from '@/lib/utils/count'
import { cn } from '@/lib/utils/ui'

type Line = { id: string; text: string; stockedId: string | null }

// Clearing the cart is when the shopping is put away. Each ticked line says
// what it would do to what is on hand (top up something there, or add it
// new), and starts picked; untick any that should just leave the list.
export function ClearCartDialog({
	open,
	onOpenChange,
	lines,
	pantry,
	onClear,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	lines: Line[]
	pantry: readonly { name: string }[]
	onClear: (stock: string[]) => void
}) {
	// Lines ticked before ticks stopped filling the pantry are on hand already.
	const fresh = lines.filter((line) => !line.stockedId)
	const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
	const picked = fresh.filter((line) => !skipped.has(line.id))

	const close = (next: boolean) => {
		if (!next) setSkipped(new Set())
		onOpenChange(next)
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>
						clear {count(lines.length, 'item', 'items')} from your list?
					</DialogTitle>
					<DialogDescription>
						{fresh.length
							? 'what’s picked goes into on hand. untick anything you’d rather leave out.'
							: 'these are on hand already, so they just come off the list.'}
					</DialogDescription>
				</DialogHeader>
				{fresh.length ? (
					<ul className="divide-border -my-1 flex max-h-[50dvh] flex-col divide-y overflow-y-auto">
						{fresh.map((line) => {
							const on = !skipped.has(line.id)
							const have = findInPantry(line.text, pantry)

							return (
								<li key={line.id}>
									<label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
										<input
											type="checkbox"
											checked={on}
											onChange={(event) =>
												setSkipped((now) => {
													const next = new Set(now)

													if (event.target.checked) next.delete(line.id)
													else next.add(line.id)

													return next
												})
											}
											className="accent-kitchen-basil size-5 shrink-0"
										/>
										<span
											className={cn(
												'min-w-0 flex-1 truncate text-base',
												!on && 'text-muted-foreground line-through',
											)}
										>
											{line.text}
										</span>
										<span className="text-muted-foreground shrink-0 text-sm font-semibold">
											{!on ? 'leave out' : have ? 'restock' : 'new'}
										</span>
									</label>
								</li>
							)
						})}
					</ul>
				) : null}
				<DialogFooter>
					<Button variant="outline" onClick={() => close(false)}>
						cancel
					</Button>
					<Button
						onClick={() => {
							onClear(picked.map((line) => line.id))
							close(false)
						}}
					>
						{picked.length ? `clear and add ${picked.length}` : 'just clear'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
