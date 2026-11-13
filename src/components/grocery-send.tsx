import {
	ArrowRightIcon,
	CheckIcon,
	PlusIcon,
	ShoppingCartIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AuthDialog } from '@/components/auth-dialog'
import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { ExtraTag, KitchenTag } from '@/components/kitchen-tag'
import { PantrySprite } from '@/components/pantry-sprite'
import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { usePantry, useWaitingGroceries } from '@/components/use-pantry'
import { authClient } from '@/lib/auth/client'
import { groceryList } from '@/lib/groceries/list'
import { addGroceries } from '@/lib/groceries/server'
import { restockPantry } from '@/lib/pantry/server'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { lineStatus, wantsBuying } from '@/lib/pantry/status'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { cn } from '@/lib/utils/ui'

// A recipe's ingredients, sent to the groceries list: the cart opens every
// line, to untick what the kitchen has before anything goes on the list. The
// button says how much of what it needs is on the list, and how many more
// it would add.
// Adding other things and changing a line live on the groceries page.
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
	// A list needs an account: signed out, the button asks for one first.
	const [authOpen, setAuthOpen] = useState(false)
	const client = useQueryClient()
	const account = authClient.useSession().data?.user
	const signedIn = !!account

	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	const items = groceryList(lines)
	const pantry = usePantry(true)
	const waiting = useWaitingGroceries(true)

	if (!items.length) return null

	const known = pantry.isSuccess && waiting.isSuccess

	const statuses = items.map((item) =>
		lineStatus(item, pantry.data ?? [], waiting.data ?? []),
	)

	const wanted = statuses.filter(wantsBuying).length
	const listed = statuses.filter((status) => status?.kind === 'list').length

	const pill =
		'border-input hover:bg-muted/60 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors'

	// What the recipe sends shopping, and how much of it the list holds,
	// says itself on the button, the one count on the recipe. With all of it
	// on the list it leads there; with nothing to shop for, there is no
	// button.
	const shopping = wanted + listed

	if (known && !wanted)
		return listed ? (
			<Link
				to="/kitchen"
				hash="need"
				aria-label={`all ${shopping} on your list: groceries list`}
				className={pill}
			>
				<ShoppingCartIcon size={16} weight="bold" aria-hidden />
				<span className="tabular-nums">
					{shopping}/{shopping}
				</span>
				<CheckIcon size={14} weight="bold" aria-hidden />
				<ArrowRightIcon size={14} weight="bold" aria-hidden />
			</Link>
		) : null

	return (
		<>
			<button
				type="button"
				onClick={() => (signedIn ? setOpen(true) : setAuthOpen(true))}
				aria-label={
					known
						? `add ${wanted} to groceries, ${listed} of ${shopping} on your list`
						: undefined
				}
				className={pill}
			>
				<ShoppingCartIcon size={16} weight="bold" aria-hidden />
				{known ? (
					<>
						<span className="tabular-nums">
							{listed}/{shopping}
						</span>
						<span aria-hidden>·</span>
						add {wanted}
					</>
				) : (
					'add to groceries'
				)}
			</button>
			<AuthDialog
				open={authOpen}
				onOpenChange={setAuthOpen}
				redirect={pathname}
				// Signed in, the cook goes on to the list they asked for, read
				// again for the account's own pantry and list.
				onSuccess={() => {
					void client.invalidateQueries({ queryKey: ['pantry'] })
					void client.invalidateQueries({ queryKey: ['groceries'] })
					setOpen(true)
				}}
			/>
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
// an unticked one stays off it. What is needed, running low or not seen in a
// while starts ticked; what is on the list or had starts unticked. Each says
// why.
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

	const pantry = usePantry(true).data ?? []
	const waiting = useWaitingGroceries(true).data ?? []
	const statuses = items.map((item) => lineStatus(item, pantry, waiting))
	// A cook with no pantry or list yet gets no notes: "need" on every line
	// would say nothing.
	const knows = pantry.length > 0 || waiting.length > 0

	// Lines the kitchen has that the cook will buy anyway, ticked in place.
	const [anyway, setAnyway] = useState<ReadonlySet<number>>(() => new Set())

	const ticked = (index: number) =>
		wantsBuying(statuses[index]) ? (ticks[index] ?? true) : anyway.has(index)

	const chosen = items.flatMap((_, index) => (ticked(index) ? [index] : []))

	function buyAnyway(index: number, on: boolean) {
		setAnyway((now) => {
			const next = new Set(now)

			if (on) next.add(index)
			else next.delete(index)

			return next
		})
	}

	const indexes = items.map((_, index) => index)
	const buying = indexes.filter((index) => wantsBuying(statuses[index]))
	const having = indexes.filter((index) => !wantsBuying(statuses[index]))

	async function add() {
		setAdding(true)

		try {
			const added = await addGroceries({
				// The list takes a hundred lines at a time, each up to 200 letters.
				data: chosen.slice(0, 100).map((index) => ({
					text: (items[index] ?? '').slice(0, 200),
					recipeId,
					recipeTitle: title,
				})),
			})

			// Unticking a line says the kitchen has it: the pantry learns so,
			// and keeps it as long as that food keeps.
			const had = items.filter(
				(_, index) => wantsBuying(statuses[index]) && ticks[index] === false,
			)

			if (had.length)
				void restockPantry({
					data: had.map((text) => ({
						text,
						category: ingredientCategory(text),
					})),
				})
					.then(() => client.invalidateQueries({ queryKey: ['pantry'] }))
					// Learning is a bonus; the list is what was asked for.
					.catch(() => undefined)

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
						onClick: () => void navigate({ to: '/kitchen', hash: 'need' }),
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
				{/* Every line of the recipe, straight on the dialog, in two groups:
				    what to buy, ticked to add, and what the kitchen has, a plus from
				    buying anyway, ticked where it stands. */}
				<fieldset
					aria-label="items to add"
					className="scrollbar-visible -mt-2 flex max-h-[55dvh] flex-col gap-4 overflow-y-auto"
				>
					{buying.length ? (
						<section aria-labelledby="to-buy">
							<GroupHeading id="to-buy">to buy</GroupHeading>
							<ul className="divide-border divide-y">
								{buying.map((index) => {
									const on = ticked(index)

									return (
										// The same line can appear twice in a recipe.
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
												<FoodIcon text={items[index] ?? ''} />
												<span
													className={cn(
														'min-w-0 flex-1 text-base',
														!on && 'text-muted-foreground',
													)}
												>
													{items[index]}
												</span>
												{/* Why the line starts as it does. */}
												<KitchenTag
													status={knows ? statuses[index] : undefined}
													listed="on your list"
												/>
											</label>
										</li>
									)
								})}
							</ul>
						</section>
					) : null}
					{having.length ? (
						<section aria-labelledby="already-have">
							<GroupHeading id="already-have">already have</GroupHeading>
							<ul className="divide-border divide-y">
								{having.map((index) =>
									anyway.has(index) ? (
										<li key={index}>
											<label className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
												<input
													type="checkbox"
													checked
													onChange={() => buyAnyway(index, false)}
													className="accent-kitchen-basil size-5 shrink-0"
												/>
												<FoodIcon text={items[index] ?? ''} />
												<span className="min-w-0 flex-1 text-base">
													{items[index]}
												</span>
												{/* Had, but going on the list all the same. */}
												<ExtraTag />
											</label>
										</li>
									) : (
										<li
											key={index}
											className="flex min-h-11 items-center gap-3 py-1.5"
										>
											<button
												type="button"
												aria-label={`buy ${items[index]} anyway`}
												onClick={() => buyAnyway(index, true)}
												className="border-input hover:bg-muted/60 grid size-5 shrink-0 place-items-center rounded-full border transition-colors"
											>
												<PlusIcon size={12} weight="bold" aria-hidden />
											</button>
											<FoodIcon text={items[index] ?? ''} />
											<span className="text-muted-foreground min-w-0 flex-1 text-base">
												{items[index]}
											</span>
											<KitchenTag
												status={statuses[index]}
												listed="on your list"
											/>
										</li>
									),
								)}
							</ul>
						</section>
					) : null}
				</fieldset>
				<DialogFooter>
					<button
						type="button"
						disabled={!chosen.length || adding}
						onClick={() => void add()}
						className={buttonVariants()}
					>
						{adding ? 'adding…' : `add ${chosen.length}`}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// A group's name over its rows.
function GroupHeading({
	id,
	children,
}: {
	id: string
	children: React.ReactNode
}) {
	return (
		<h3 id={id} className="text-muted-foreground pb-1 text-sm font-bold">
			{children}
		</h3>
	)
}

// The food's picture, as on the grocery list; a food without one keeps its
// place blank so the names line up.
function FoodIcon({ text }: { text: string }) {
	const look = ingredientItemLook(text)

	return (
		<span aria-hidden className="grid size-6 shrink-0 place-items-center">
			{look ? <PantrySprite look={look} className="size-6" /> : null}
		</span>
	)
}
