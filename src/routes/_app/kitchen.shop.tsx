import {
	CaretDownIcon,
	CheckIcon,
	ExportIcon,
	MinusIcon,
	PencilSimpleIcon,
	PlusIcon,
	ShoppingCartIcon,
	TrashIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import {
	AnimatePresence,
	LayoutGroup,
	motion,
	useReducedMotion,
} from 'framer-motion'
import {
	startTransition,
	useEffect,
	useOptimistic,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

import { AmountBar } from '@/components/amount-bar'
import { groceryCountKey } from '@/components/grocery-badge'
import { useGroceryComposer } from '@/components/grocery-entry'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { TickBox } from '@/components/tick-box'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { undoToast } from '@/components/undo-toast'
import { shoppingUnitsFor, stepShopping } from '@/lib/groceries/amounts'
import { sameItem, type GroceryInput } from '@/lib/groceries/model'
import {
	addGroceries,
	clearCheckedGroceries,
	deleteGrocery,
	listGroceries,
	renameGrocery,
	setGroceryChecked,
} from '@/lib/groceries/server'
import { pantryCategoryLabels, type PantryCategory } from '@/lib/pantry/model'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { amountOf, withAmount } from '@/lib/recipes/ingredient-line'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/kitchen/shop')({
	// Adding floats above the tab bar on phones, as on the other tabs.
	staticData: { tabBar: 'own-fab' },
	loader: () => listGroceries(),
	component: GroceriesPage,
})

type Item = NonNullable<Awaited<ReturnType<typeof listGroceries>>>[number]

// A list is kept by an account; signed out, the page says so.
function GroceriesPage() {
	const saved = Route.useLoaderData()

	if (saved) return <Groceries saved={saved} />

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 md:p-10">
				<h1 className="sr-only">shopping</h1>
				<SignUpToKeep
					picture={
						<ShoppingCartIcon
							size={56}
							weight="duotone"
							aria-hidden
							className="text-muted-foreground"
						/>
					}
					title="keep a grocery list"
					body="sign up to send a recipe's ingredients here and shop by aisle"
				/>
			</div>
		</main>
	)
}

type Change =
	| { kind: 'add'; items: Item[] }
	| { kind: 'check'; id: string; checked: boolean }
	| { kind: 'rename'; id: string; text: string }
	| { kind: 'remove'; id: string }
	| { kind: 'clear' }

// The list as it will be once a change lands, shown at once so a tick in the
// store never waits on the network.
function applyChange(items: Item[], change: Change): Item[] {
	switch (change.kind) {
		case 'add': {
			// The server's copy may land while the shown one is still here.
			const known = new Set(items.map((item) => item.id))

			return [...items, ...change.items.filter((item) => !known.has(item.id))]
		}

		case 'check':
			return items.map((item) =>
				item.id === change.id
					? { ...item, checkedAt: change.checked ? new Date() : null }
					: item,
			)
		case 'rename':
			return items.map((item) =>
				item.id === change.id
					? {
							...item,
							text: change.text,
							category: ingredientCategory(change.text),
						}
					: item,
			)
		case 'remove':
			return items.filter((item) => item.id !== change.id)
		case 'clear':
			return items.filter((item) => !item.checkedAt)
	}
}

// A typed item as it shows before the server has it, under the id the server
// will keep for it.
const draftItem = (text: string): Item => ({
	id: crypto.randomUUID(),
	userId: '',
	text,
	category: ingredientCategory(text),
	recipeId: null,
	recipeTitle: null,
	checkedAt: null,
	stockedId: null,
	stockedWas: null,
	createdAt: new Date(),
})

// One list for the shop, shelved by aisle in the order of a walk through it.
// A ticked item leaves its aisle for the completed box at the foot, where
// a tick takes it back out. Edit turns every row into one to change. Once
// anything is ticked, the list ends on putting it away.
function Groceries({ saved }: { saved: Item[] }) {
	const router = useRouter()
	const navigate = useNavigate()
	const client = useQueryClient()
	const [items, apply] = useOptimistic(saved, applyChange)

	const [editing, setEditing] = useState(false)
	// The item whose sheet is open, for its amount in another unit.
	const [openId, setOpenId] = useState<string>()

	// While items are ticked one after another, the list holds still: a row
	// ticked or unticked shows its tick where it is, and slides to its new box
	// only once the ticking stops, so the next tap never lands on a row that
	// just moved. Held, each row keeps the box it was in and its place there:
	// when it was ticked, or 0 if it was not.
	const [held, setHeld] = useState<ReadonlyMap<string, number>>()
	const thaw = useRef<ReturnType<typeof setTimeout>>(undefined)

	useEffect(() => () => clearTimeout(thaw.current), [])

	function hold() {
		setHeld(
			(now) => now ?? new Map(items.map((item) => [item.id, tickedAt(item)])),
		)
		clearTimeout(thaw.current)
		thaw.current = setTimeout(() => setHeld(undefined), settleAfter)
	}

	// The item just added, lit for a moment so the eye finds its aisle.
	const [fresh, setFresh] = useState<string>()

	useEffect(() => {
		if (!fresh) return
		const timer = setTimeout(() => setFresh(undefined), 1500)

		return () => clearTimeout(timer)
	}, [fresh])

	const waiting = items.filter((item) => !item.checkedAt)
	const inCart = items.filter((item) => item.checkedAt)
	const allInCart = inCart.length > 0 && waiting.length === 0

	// Changes reach the server one after another, so a tick sent right after
	// an add waits for the add to land.
	const sending = useRef<Promise<void>>(undefined)

	function change(next: Change, send: () => Promise<void>) {
		startTransition(async () => {
			apply(next)

			const sent = (sending.current ?? Promise.resolve()).then(send)
			sending.current = sent.catch(() => undefined)

			try {
				await sent
			} catch {
				toast.error("couldn't update the list — try again")
			}

			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: groceryCountKey }),
			])
		})
	}

	// A tick puts the item in the kitchen at once, said with a way back.
	function check(item: Item, checked: boolean) {
		hold()
		change({ kind: 'check', id: item.id, checked }, async () => {
			const done = await setGroceryChecked({ data: { id: item.id, checked } })

			if (done?.stocked)
				undoToast(
					done.stocked.created
						? `added ${done.stocked.name} to your kitchen`
						: `${done.stocked.name}: back to enough`,
					() => check(item, false),
					'stocked',
				)
		})
	}

	// Done shopping: what is in the cart is already in the kitchen, so it
	// leaves the list, and the kitchen shows again.
	async function done() {
		if (inCart.length)
			change({ kind: 'clear' }, async () => {
				await clearCheckedGroceries()
			})
		await navigate({ to: '/kitchen' })
	}

	function add(text: string) {
		const same = items.find((item) => sameItem(item.text) === sameItem(text))

		// An item already on the list is not added twice; one already in the
		// cart comes back out of it.
		if (same) {
			if (same.checkedAt) {
				check(same, false)
				toast('back on your list')
			} else toast('already on your list')

			return
		}

		const draft = draftItem(text)

		setFresh(draft.id)
		change({ kind: 'add', items: [draft] }, async () => {
			await addGroceries({ data: [{ id: draft.id, text }] })
		})
	}

	const composer = useGroceryComposer(add)

	// Puts a removed item back as it was, from the same recipe.
	function restore(item: Item) {
		const back: Item = { ...item, id: crypto.randomUUID() }
		const input: GroceryInput = { id: back.id, text: back.text }

		if (back.recipeId) input.recipeId = back.recipeId

		if (back.recipeTitle) input.recipeTitle = back.recipeTitle

		change({ kind: 'add', items: [back] }, async () => {
			await addGroceries({ data: [input] })

			if (back.checkedAt)
				await setGroceryChecked({ data: { id: back.id, checked: true } })
		})
	}

	function remove(item: Item) {
		change({ kind: 'remove', id: item.id }, async () => {
			await deleteGrocery({ data: { id: item.id } })
		})

		// A slip of the thumb is one tap from undone.
		undoToast(`removed ${item.text}`, () => restore(item))
	}

	function rename(item: Item, text: string) {
		change({ kind: 'rename', id: item.id, text }, async () => {
			await renameGrocery({ data: { id: item.id, text } })
		})
	}

	const sheetItem = items.find((item) => item.id === openId)

	// What is still to find, by aisle; what is ticked, last ticked first.
	const placeOf = (item: Item) => held?.get(item.id) ?? tickedAt(item)

	const isCompleted = (item: Item) => placeOf(item) > 0

	const toFind = items.filter((item) => !isCompleted(item))

	const completed = items
		.filter(isCompleted)
		.sort((a, b) => placeOf(b) - placeOf(a))

	const row = (item: Item) => (
		<GroceryRow
			key={item.id}
			item={item}
			fresh={item.id === fresh}
			onCheck={(checked) => check(item, checked)}
		/>
	)

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 pb-28 md:p-10">
				{/* The sidebar says where you are; the page opens on how the shop
				    goes and what it is for. */}
				<h1 className="sr-only">shopping</h1>
				{/* The list's actions, held at the top: sharing it, editing it,
				    and putting the cart away. It is there from the first item
				    typed, so the list never jumps down when that item lands. */}
				{items.length || composer.open ? (
					<div className="bg-background/90 sticky top-0 z-20 -mx-2 -mt-3 flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1 backdrop-blur-sm">
						<div className="flex-1" />
						<ShareList items={waiting.map((item) => item.text)} />
						{items.length ? (
							<button
								type="button"
								aria-pressed={editing}
								onClick={() => setEditing((now) => !now)}
								className={buttonVariants({
									variant: editing ? 'saved' : 'outline',
									className: 'px-3',
								})}
							>
								{editing ? (
									<CheckIcon size={14} weight="bold" aria-hidden />
								) : (
									<PencilSimpleIcon size={14} weight="bold" aria-hidden />
								)}
								{editing ? 'done' : 'edit'}
							</button>
						) : null}
						<button
							type="button"
							onClick={() => void done()}
							className={buttonVariants({
								variant: allInCart ? 'default' : 'outline',
								className: 'px-3',
							})}
						>
							done
						</button>
					</div>
				) : null}
				{/* On a phone the plus waits for items: an empty list has its own way
				    in. */}
				{items.length ? composer.button : null}
				{items.length && editing ? (
					<PlanList
						items={items}
						onChange={(item, text) => rename(item, text)}
						onUnits={(item) => setOpenId(item.id)}
						onRemove={(item) => remove(item)}
					/>
				) : null}
				{items.length && !editing ? (
					<LayoutGroup>
						<div className="-mb-5 flex flex-col">
							<AnimatePresence initial={false}>
								{shelved(toFind).map(({ category, items: aisle }) => (
									<ListBox
										key={category}
										label={pantryCategoryLabels[category]}
										items={aisle}
										row={row}
									/>
								))}
								{completed.length ? (
									<ListBox
										key="completed"
										label="in your kitchen"
										items={completed}
										row={row}
									/>
								) : null}
							</AnimatePresence>
						</div>
					</LayoutGroup>
				) : null}
				{items.length || composer.open ? null : (
					<EmptyList onAdd={composer.start} />
				)}
				{/* Items are added down the list, at its end: the row the plus opens,
				    or on a wide screen the add row in its place. One place whatever
				    the list holds, so it keeps focus as the first item lands. */}
				{composer.draft}
				{!items.length || composer.open ? null : (
					<button
						type="button"
						onClick={composer.start}
						className="border-foreground/30 text-muted-foreground hover:text-foreground hover:border-input hidden min-h-13 items-center gap-3 rounded-xl border border-dashed px-3 text-left text-base transition-colors md:flex"
					>
						<span className="border-foreground/40 grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed">
							<PlusIcon size={12} weight="bold" aria-hidden />
						</span>
						add an item
					</button>
				)}
				{sheetItem ? (
					<GroceryDetails
						key={sheetItem.id}
						item={sheetItem}
						onRename={(text) => rename(sheetItem, text)}
						onRemove={() => {
							setOpenId(undefined)
							remove(sheetItem)
						}}
						onClose={() => setOpenId(undefined)}
					/>
				) : null}
			</div>
		</main>
	)
}

// Nothing to buy yet: an empty cart, one line on what adding does, and the
// way to add.
function EmptyList({ onAdd }: { onAdd: () => void }) {
	return (
		<section
			aria-labelledby="nothing-to-buy"
			className="border-foreground/30 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center"
		>
			<ShoppingCartIcon
				size={56}
				weight="duotone"
				aria-hidden
				className="text-muted-foreground"
			/>
			<div className="flex flex-col gap-1">
				<h2 id="nothing-to-buy" className="text-lg font-bold">
					nothing to buy yet
				</h2>
				<p className="text-muted-foreground max-w-xs text-sm font-semibold">
					add what you need, and it finds its own aisle
				</p>
			</div>
			<button
				type="button"
				onClick={onAdd}
				className={buttonVariants({ className: 'min-h-11 gap-1.5' })}
			>
				<PlusIcon size={16} weight="bold" aria-hidden />
				add an item
			</button>
		</section>
	)
}

// The aisles in the order of a walk through the shop: produce at the door,
// the fridges, the dry shelves, and the freezer last.
const aisles: PantryCategory[] = [
	'vegetables',
	'fruit',
	'meat',
	'dairy',
	'grains',
	'cans',
	'sauces',
	'spices',
	'other',
	'frozen',
]

// Each aisle that holds anything, with its items in the order they came.
function shelved(items: Item[]) {
	return aisles.flatMap((category) => {
		const aisle = items.filter((item) => item.category === category)

		return aisle.length ? [{ category, items: aisle }] : []
	})
}

// When an item was ticked, or 0 while it is still to buy.
const tickedAt = (item: Item) => item.checkedAt?.getTime() ?? 0

// How long the list holds still after the last tick: long enough to see the
// tick land, short enough that the move follows it.
const settleAfter = 500

// One box of rows under its name: an aisle, or what is completed. Its name
// folds it away and opens it again.
function ListBox({
	label,
	items,
	row,
}: {
	label: string
	items: Item[]
	row: (item: Item) => React.ReactNode
}) {
	const reduceMotion = useReducedMotion()
	const [open, setOpen] = useState(true)

	return (
		// A box comes and goes by its height as well as its look, the space
		// under it included, so the boxes below slide rather than jump.
		<motion.section
			aria-label={label}
			layout="position"
			// It clips only while it grows or shrinks, so a row sliding in from
			// another box is never cut off.
			initial={
				reduceMotion ? false : { opacity: 0, height: 0, overflow: 'hidden' }
			}
			animate={{
				opacity: 1,
				height: 'auto',
				transitionEnd: { overflow: 'visible' },
			}}
			exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
			transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
		>
			<div className="pb-5">
				<h2 className="text-muted-foreground px-1 pb-1 text-sm font-bold">
					<button
						type="button"
						aria-expanded={open}
						onClick={() => setOpen((now) => !now)}
						className="hover:text-foreground -mx-1 inline-flex min-h-10 items-center gap-2 rounded-md px-1 transition-colors"
					>
						{label}
						{open ? null : (
							<span className="font-semibold tabular-nums">
								· {items.length}
							</span>
						)}
						<CaretDownIcon
							size={12}
							weight="bold"
							aria-hidden
							className={cn('transition-transform', open && 'rotate-180')}
						/>
					</button>
				</h2>
				<AnimatePresence initial={false}>
					{open ? (
						<motion.div
							key="rows"
							initial={
								reduceMotion
									? false
									: { height: 0, opacity: 0, overflow: 'hidden' }
							}
							animate={{
								height: 'auto',
								opacity: 1,
								transitionEnd: { overflow: 'visible' },
							}}
							exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
							transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
						>
							<ul className="bg-card border-border divide-border divide-y rounded-xl border">
								<AnimatePresence initial={false}>
									{items.map(row)}
								</AnimatePresence>
							</ul>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</motion.section>
	)
}

// A row in the shop: all of it ticks, in a target a thumb finds without
// looking. Changing the item is for edit.
function GroceryRow({
	item,
	fresh,
	onCheck,
}: {
	item: Item
	fresh: boolean
	onCheck: (checked: boolean) => void
}) {
	const reduceMotion = useReducedMotion()
	const checked = !!item.checkedAt
	const look = ingredientItemLook(item.text)

	return (
		<motion.li
			data-grocery={item.id}
			// A ticked item slides down into the completed box, and back up to
			// its aisle when unticked, while the rows around it close the gap.
			layoutId={item.id}
			layout="position"
			initial={reduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, x: -24 }}
			transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeInOut' }}
			className={cn(
				'scroll-my-6 overflow-hidden transition-colors duration-700 first:rounded-t-xl last:rounded-b-xl',
				fresh && 'bg-kitchen-yolk/30',
			)}
		>
			{/* The tick is drawn, not a font's glyph, so it looks the same on
			    every phone. */}
			<label
				htmlFor={`tick-${item.id}`}
				className="hover:bg-muted/40 flex min-h-15 cursor-pointer items-center gap-3.5 px-4 transition-colors"
			>
				<TickBox
					id={`tick-${item.id}`}
					aria-label={item.text}
					checked={checked}
					onChange={(event) => onCheck(event.target.checked)}
				/>
				<span
					aria-hidden
					className={cn(
						'grid size-7 shrink-0 place-items-center transition-opacity',
						checked && 'opacity-50',
					)}
				>
					{look ? <PantrySprite look={look} className="size-7" /> : null}
				</span>
				<span
					className={cn(
						'min-w-0 flex-1 py-2 text-lg',
						checked && 'text-muted-foreground line-through',
					)}
				>
					{item.text}
				</span>
			</label>
		</motion.li>
	)
}

// The list to change: each item's name to retype, its amount a step up or
// down, and a cross to take it off, by aisle.
function PlanList({
	items,
	onChange,
	onUnits,
	onRemove,
}: {
	items: Item[]
	onChange: (item: Item, text: string) => void
	onUnits: (item: Item) => void
	onRemove: (item: Item) => void
}) {
	const groups = shelved(items).map(({ category, items: aisle }) => ({
		key: category,
		label: pantryCategoryLabels[category],
		items: aisle,
	}))

	return (
		<div className="flex flex-col gap-5">
			{groups.map((group) => (
				<section key={group.key} aria-label={group.label}>
					<h2 className="text-muted-foreground px-1 pb-1 text-sm font-bold">
						{group.label}
					</h2>
					<ul className="bg-card border-border divide-border divide-y rounded-xl border">
						{group.items.map((item) => (
							<PlanRow
								key={item.id}
								item={item}
								onChange={(text) => onChange(item, text)}
								onUnits={() => onUnits(item)}
								onRemove={() => onRemove(item)}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}

// One item to change: its name in place, its amount on a stepper whose
// label opens the units, and a cross.
function PlanRow({
	item,
	onChange,
	onUnits,
	onRemove,
}: {
	item: Item
	onChange: (text: string) => void
	onUnits: () => void
	onRemove: () => void
}) {
	const amount = amountOf(item.text)
	const name = amount ? amount.rest : item.text
	const [draft, setDraft] = useState(name)
	// A rename made elsewhere (the sheet) starts the draft over; stepping the
	// amount leaves the name, and the row's focus, alone.
	const [seenName, setSeenName] = useState(name)

	if (name !== seenName) {
		setSeenName(name)
		setDraft(name)
	}

	// Escape cancels the edit; the blur it causes must not save it.
	const cancelled = useRef(false)
	const look = ingredientItemLook(item.text)

	// The name as typed, kept with the amount it had.
	function commit() {
		if (cancelled.current) {
			cancelled.current = false

			return
		}

		const next = draft.trim()

		if (!next || next === name) {
			setDraft(name)

			return
		}

		onChange(amount ? withAmount(amount.quantity, amount.unit, next) : next)
	}

	const step =
		'grid size-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-muted/60 disabled:opacity-40'

	return (
		<li
			data-grocery={item.id}
			className="flex min-h-14 items-center gap-2 py-1.5 pr-1.5 pl-3"
		>
			<span aria-hidden className="grid size-7 shrink-0 place-items-center">
				{look ? <PantrySprite look={look} className="size-7" /> : null}
			</span>
			<input
				aria-label={`name of ${item.text}`}
				value={draft}
				maxLength={200}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === 'Enter') event.currentTarget.blur()

					if (event.key === 'Escape') {
						cancelled.current = true
						setDraft(name)
						event.currentTarget.blur()
					}
				}}
				className={cn(
					'border-input/60 focus:border-foreground min-w-0 flex-1 border-b border-dashed bg-transparent py-1 text-base outline-none',
					item.checkedAt && 'text-muted-foreground line-through',
				)}
			/>
			<div className="border-input flex shrink-0 items-center rounded-md border">
				<button
					type="button"
					aria-label={`less ${name}`}
					disabled={!amount}
					onClick={() => onChange(stepShopping(item.text, -1))}
					className={step}
				>
					<MinusIcon size={14} weight="bold" aria-hidden />
				</button>
				<button
					type="button"
					aria-label={`amount of ${name}, change units`}
					aria-haspopup="dialog"
					onClick={onUnits}
					className="hover:bg-muted/60 min-w-10 px-1 text-sm font-bold tabular-nums transition-colors"
				>
					{amount ? withAmount(amount.quantity, amount.unit, '').trim() : '–'}
				</button>
				<button
					type="button"
					aria-label={`more ${name}`}
					onClick={() => onChange(stepShopping(item.text, 1))}
					className={step}
				>
					<PlusIcon size={14} weight="bold" aria-hidden />
				</button>
			</div>
			<button
				type="button"
				aria-label={`remove ${item.text}`}
				onClick={onRemove}
				className="text-muted-foreground hover:text-foreground hover:bg-muted/60 grid size-10 shrink-0 place-items-center rounded-md transition-colors"
			>
				<XIcon size={16} weight="bold" aria-hidden />
			</button>
		</li>
	)
}

// One item up close: its amount in a shop's units, its name, the recipe it
// is for, and deleting it. A change is kept as it closes, unless escape
// takes it back.
function GroceryDetails({
	item,
	onRename,
	onRemove,
	onClose,
}: {
	item: Item
	onRename: (text: string) => void
	onRemove: () => void
	onClose: () => void
}) {
	const [text, setText] = useState(item.text)
	const look = text.trim() ? ingredientItemLook(text) : undefined
	const done = useRef<HTMLButtonElement>(null)

	function finish(cancelled = false) {
		const trimmed = text.trim()

		if (!cancelled && trimmed && trimmed !== item.text) onRename(trimmed)
		onClose()
	}

	return (
		<ItemSheet
			anchor={() => document.querySelector(`[data-grocery="${item.id}"]`)}
			title={item.text}
			onClose={finish}
			// A finger opens it for the amount's steps, not to type: the
			// keyboard stays down until the name is tapped.
			initialFocus={(type) => (type === 'touch' ? done.current : true)}
		>
			{item.recipeTitle ? (
				<p className="text-muted-foreground text-sm font-semibold">
					for {item.recipeTitle}
				</p>
			) : null}
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<span aria-hidden className="grid size-7 shrink-0 place-items-center">
						{look ? <PantrySprite look={look} className="size-7" /> : null}
					</span>
					<Input
						aria-label="item"
						value={text}
						maxLength={200}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') finish()
						}}
					/>
				</div>
				<AmountBar
					line={text}
					onChange={setText}
					units={shoppingUnitsFor(text)}
					shopping
					className="px-0 pb-0 md:pl-0"
				/>
			</div>
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={onRemove}
					className={buttonVariants({ variant: 'destructive' })}
				>
					<TrashIcon size={16} weight="bold" aria-hidden />
					delete
				</button>
				<ItemSheetDone ref={done} className={buttonVariants()}>
					done
				</ItemSheetDone>
			</div>
		</ItemSheet>
	)
}

const noSubscription = () => () => {}

// The list as text, one item a line, to send where the phone can share it.
function ShareList({ items }: { items: string[] }) {
	const text = items.join('\n')

	// Known only in the browser; the server renders without it.
	const canShare = useSyncExternalStore(
		noSubscription,
		() => 'share' in navigator,
		() => false,
	)

	if (!items.length || !canShare) return null

	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await navigator.share({ title: 'groceries', text })
				} catch (error) {
					if (error instanceof DOMException && error.name === 'AbortError')
						return
					toast.error("couldn't share the list — try again")
				}
			}}
			className={buttonVariants({ variant: 'outline' })}
		>
			<ExportIcon size={16} weight="bold" aria-hidden />
			share
		</button>
	)
}
