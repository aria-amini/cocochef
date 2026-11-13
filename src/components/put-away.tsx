import { ArrowClockwiseIcon, PlusIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { PantrySprite } from '@/components/pantry-sprite'
import { TickBox } from '@/components/tick-box'
import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { pantryNameOf } from '@/lib/groceries/list'
import { findInPantry, foodOf } from '@/lib/pantry/foods'
import { pantryLevelLabels, type PantryCategory } from '@/lib/pantry/model'
import { listPantry, restockPantry } from '@/lib/pantry/server'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

type Bought = {
	id: string
	text: string
	category: PantryCategory
	recipeTitle: string | null
}

type Pantry = NonNullable<Awaited<ReturnType<typeof listPantry>>>

// What saving does to one bought item: a new ingredient under the name it
// will have, or one already kept, filled back up to enough and dated today.
function effectOf(text: string, pantry: Pantry | undefined) {
	if (!pantry) return undefined
	const kept = findInPantry(text, pantry)

	return kept
		? ({ kind: 'refill', name: kept.name, level: kept.level } as const)
		: ({ kind: 'new', name: pantryNameOf(text) } as const)
}

// Shopping done: what was bought goes into ingredients, dated today, and the
// cart empties. All of it starts ticked; each row says what saving it does,
// a new ingredient or one filled back up. Or the cart just empties, with
// nothing saved.
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

	const pantry = useQuery({
		queryKey: ['pantry', 'all'],
		queryFn: () => listPantry(),
	})

	const ticked = (item: Bought) => ticks[item.id] ?? true
	const chosen = items.filter(ticked)

	const effects = new Map(
		items.map((item) => [
			item.id,
			effectOf(item.text, pantry.data ?? undefined),
		]),
	)

	const adding = chosen.filter((item) => effects.get(item.id)?.kind === 'new')
	const refilling = chosen.length - adding.length

	function clearOnly() {
		onClear()
		onClose()
		toast('cleared the cart, nothing saved')
	}

	async function finish() {
		setSaving(true)

		try {
			await restockPantry({
				data: chosen.map(({ text, category }) => ({ text, category })),
			})
			void client.invalidateQueries({ queryKey: ['pantry'] })
			toast.success(`saved ${chosen.length} to ingredients`, {
				action: {
					label: 'open',
					onClick: () => void navigate({ to: '/ingredients' }),
				},
			})
			onClear()
			onClose()
		} catch {
			toast.error("couldn't save that — try again")
		} finally {
			setSaving(false)
		}
	}

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="flex flex-col">
				<DialogHeader className="mr-8">
					<DialogTitle>finish shopping</DialogTitle>
				</DialogHeader>
				<p
					aria-live="polite"
					className="text-muted-foreground -mb-3 text-sm font-semibold"
				>
					{!chosen.length
						? 'nothing ticked goes into ingredients'
						: pantry.data
							? [
									adding.length ? `${adding.length} new` : '',
									refilling ? `${refilling} filled back up` : '',
								]
									.filter(Boolean)
									.join(' · ') + ' in your ingredients'
							: `${chosen.length} into your ingredients`}
				</p>
				<ul
					aria-label="bought"
					className="divide-border border-border scrollbar-visible max-h-[55dvh] divide-y overflow-y-auto border-y"
				>
					{items.map((item) => {
						const on = ticked(item)
						const forOne = !foodOf(item.text)?.staple && item.recipeTitle
						const sprite = ingredientItemLook(item.text)
						const effect = effects.get(item.id)

						return (
							<li key={item.id}>
								<label className="flex min-h-13 cursor-pointer items-center gap-3 py-2">
									<TickBox
										checked={on}
										onChange={(event) =>
											setTicks((now) => ({
												...now,
												[item.id]: event.target.checked,
											}))
										}
									/>
									<span
										aria-hidden
										className="grid size-6 shrink-0 place-items-center"
									>
										{sprite ? (
											<PantrySprite look={sprite} className="size-6" />
										) : null}
									</span>
									<span className="flex min-w-0 flex-1 flex-col">
										<span
											className={cn(
												'text-base',
												!on && 'text-muted-foreground line-through',
											)}
										>
											{item.text}
										</span>
										<span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-semibold">
											{!on ? (
												'not saved'
											) : effect?.kind === 'new' ? (
												<>
													<PlusIcon size={12} weight="bold" aria-hidden />
													new: {effect.name}
												</>
											) : effect ? (
												<>
													<ArrowClockwiseIcon
														size={12}
														weight="bold"
														aria-hidden
													/>
													{effect.name}:{' '}
													{effect.level === 'plenty'
														? 'still enough, dated today'
														: `${pantryLevelLabels[effect.level]} → enough`}
												</>
											) : null}
											{on && forOne ? ` · for ${forOne}` : null}
										</span>
									</span>
								</label>
							</li>
						)
					})}
				</ul>
				<DialogFooter>
					<button
						type="button"
						disabled={saving}
						onClick={clearOnly}
						className={buttonVariants({ variant: 'outline' })}
					>
						clear without saving
					</button>
					{chosen.length ? (
						<button
							type="button"
							disabled={saving}
							onClick={() => void finish()}
							className={buttonVariants()}
						>
							{saving ? 'saving…' : `save ${chosen.length} & clear`}
						</button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
