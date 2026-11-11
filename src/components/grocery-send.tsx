import { ShoppingCartIcon } from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { groceryList } from '@/lib/groceries/list'
import { sameItem } from '@/lib/groceries/model'
import { addGroceries, listGroceries } from '@/lib/groceries/server'
import { cn } from '@/lib/utils/ui'

// A recipe's ingredients, sent to the groceries list: the cart opens every
// line, to untick what the kitchen has before anything goes on the list.
// Adding other things, changing a line, copying and sharing all live on the
// groceries page.
export function AddToGroceries({
	recipeId,
	title,
	lines,
}: {
	recipeId: string
	title: string
	lines: string[]
}) {
	const [open, setOpen] = useState(false)
	const items = groceryList(lines)

	if (!items.length) return null

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="border-input hover:bg-muted/60 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors"
			>
				<ShoppingCartIcon size={16} weight="bold" aria-hidden />
				add to groceries
			</button>
			{open ? (
				<GroceryReview
					recipeId={recipeId}
					title={title}
					items={items}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	)
}

// The recipe's lines with what each will do: a ticked one goes on the list,
// an unticked one stays off it. A line already waiting on the list starts
// unticked, so nothing is added twice.
function GroceryReview({
	recipeId,
	title,
	items,
	onClose,
}: {
	recipeId: string
	title: string
	items: string[]
	onClose: () => void
}) {
	const navigate = useNavigate()
	const client = useQueryClient()
	const [adding, setAdding] = useState(false)
	// The cook's own ticks, by line; the rest follow the list.
	const [ticks, setTicks] = useState<Record<number, boolean>>({})

	const waiting = useQuery({
		queryKey: ['groceries', 'waiting'],
		queryFn: async () =>
			new Set(
				(await listGroceries())
					.filter((item) => !item.checkedAt)
					.map((item) => sameItem(item.text)),
			),
		staleTime: 0,
	})

	const onList = (item: string) => waiting.data?.has(sameItem(item)) ?? false
	const ticked = (index: number) => ticks[index] ?? !onList(items[index] ?? '')

	const chosen = items.filter((_, index) => ticked(index))
	const alreadyOn = items.filter(onList).length

	const tickAll = (on: boolean) =>
		setTicks(Object.fromEntries(items.map((_, index) => [index, on])))

	async function add() {
		setAdding(true)

		try {
			const added = await addGroceries({
				// The list takes a hundred lines at a time, each up to 200 letters.
				data: chosen.slice(0, 100).map((item) => ({
					text: item.slice(0, 200),
					recipeId,
					recipeTitle: title,
				})),
			})

			// The groceries tab says how many landed, without leaving the recipe.
			pulseGroceries(added.length)
			void client.invalidateQueries({ queryKey: groceryCountKey })
			void client.invalidateQueries({ queryKey: ['groceries'] })
			onClose()
			toast.success(
				added.length
					? `${added.length} added to groceries`
					: 'already on your groceries',
				{
					action: {
						label: 'open',
						onClick: () => void navigate({ to: '/groceries' }),
					},
				},
			)
		} catch {
			toast.error('could not add to groceries. try again')
		} finally {
			setAdding(false)
		}
	}

	return (
		<Dialog
			open
			// Held open while adding, so a late answer cannot close a new review.
			onOpenChange={(next) => !next && !adding && onClose()}
		>
			<DialogContent className="flex flex-col">
				{/* Centered, clear of the corner close button on either side. */}
				<DialogHeader className="mx-8 text-center">
					<DialogTitle>add groceries</DialogTitle>
				</DialogHeader>
				<div className="text-muted-foreground -mb-3 flex items-center gap-1 text-sm font-semibold">
					<p aria-live="polite" className="flex-1">
						{chosen.length} of {items.length}
						{alreadyOn ? ` · ${alreadyOn} already on your list` : ''}
					</p>
					<button
						type="button"
						onClick={() => tickAll(true)}
						className="hover:text-foreground rounded-md px-2 py-1"
					>
						all
					</button>
					<button
						type="button"
						onClick={() => tickAll(false)}
						className="hover:text-foreground rounded-md px-2 py-1"
					>
						none
					</button>
				</div>
				{/* Every line of the recipe, straight on the dialog: a tap anywhere on
				    a row ticks it, and an unticked one fades so the two read apart. */}
				<ul
					aria-label="items to add"
					className="divide-border border-border scrollbar-visible max-h-[55dvh] divide-y overflow-y-auto border-y"
				>
					{items.map((item, index) => {
						const on = ticked(index)

						return (
							// The same line can appear twice in a recipe.
							// oxlint-disable-next-line react/no-array-index-key
							<li key={index}>
								<label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
									<input
										type="checkbox"
										checked={on}
										onChange={(event) =>
											setTicks((now) => ({
												...now,
												[index]: event.target.checked,
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
										{item}
									</span>
									{onList(item) ? (
										<span className="text-muted-foreground shrink-0 text-xs font-semibold">
											on your list
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
						disabled={!chosen.length || adding}
						onClick={() => void add()}
						className={buttonVariants()}
					>
						{adding
							? 'adding…'
							: chosen.length === items.length
								? `add all ${items.length}`
								: `add ${chosen.length} of ${items.length}`}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
