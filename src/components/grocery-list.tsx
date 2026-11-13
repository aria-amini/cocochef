import {
	CaretDownIcon,
	CheckIcon,
	MinusIcon,
	PencilSimpleIcon,
	PlusIcon,
	TrashIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
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
} from 'react'
import { toast } from 'sonner'

import { AmountBar } from '@/components/amount-bar'
import { groceryCountKey } from '@/components/grocery-badge'
import { useGroceryComposer } from '@/components/grocery-entry'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
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

export type GroceryItem = NonNullable<
	Awaited<ReturnType<typeof listGroceries>>
>[number]

type Item = GroceryItem

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

// The grocery list, shelved by aisle in the order of a walk through the
// shop. A tick puts the item in the kitchen and moves it to the box at the
// foot, where a tick takes it back out. Edit turns every row into one to
// change.
//
// It is the kitchen's groceries side, with each line saying why when the
// kitchen knows, in rows big enough for a thumb in the shop.
export function GroceryList({
	saved,
	noteOf,
	children,
}: {
	saved: Item[]
	noteOf?: (item: Item) => React.ReactNode
	// What the kitchen adds under the list: food running out, not yet on it.
	children?: React.ReactNode
}) {
	const router = useRouter()
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

	const inCart = items.filter((item) => item.checkedAt)

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

	// What is in the cart is already in the kitchen, so it can leave the list.
	function clear() {
		change({ kind: 'clear' }, async () => {
			await clearCheckedGroceries()
		})
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
			note={noteOf?.(item)}
			fresh={item.id === fresh}
			onCheck={(checked) => check(item, checked)}
		/>
	)

	// The aisles sit under the list's own heading.
	const heading = 'h3'

	// Always there, greyed while the list is empty, so the row never shifts.
	const editButton = (
		<button
			type="button"
			disabled={!items.length}
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
	)

	const list = editing ? (
		<PlanList
			items={items}
			heading={heading}
			onChange={(item, text) => rename(item, text)}
			onUnits={(item) => setOpenId(item.id)}
			onRemove={(item) => remove(item)}
		/>
	) : (
		<LayoutGroup>
			<div className="-mb-5 flex flex-col">
				<AnimatePresence initial={false}>
					{shelved(toFind).map(({ category, items: aisle }) => (
						<ListBox
							key={category}
							label={pantryCategoryLabels[category]}
							heading={heading}
							items={aisle}
							row={row}
						/>
					))}
					{completed.length ? (
						<ListBox
							key="completed"
							label="in your kitchen"
							heading={heading}
							items={completed}
							row={row}
						/>
					) : null}
				</AnimatePresence>
			</div>
		</LayoutGroup>
	)

	// Items are added down the list, at its end: the row the plus opens, or
	// the add row in its place. One place whatever the list holds, so it keeps
	// focus as the first item lands.
	const adding = (
		<>
			{composer.draft}
			{!items.length || composer.open ? null : (
				<button
					type="button"
					onClick={composer.start}
					className="border-foreground/30 text-muted-foreground hover:text-foreground hover:border-input flex min-h-12 items-center gap-3 rounded-xl border border-dashed px-3 text-left text-base transition-colors"
				>
					<span className="border-foreground/40 grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed">
						<PlusIcon size={12} weight="bold" aria-hidden />
					</span>
					add an item
				</button>
			)}
		</>
	)

	const sheet = sheetItem ? (
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
	) : null

	return (
		// One panel holds the list, its actions and its rows, so nothing
		// floats loose on the page.
		<section
			aria-labelledby="need"
			className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
		>
			<div className="flex min-h-9 flex-wrap items-center gap-2">
				{/* The kitchen's switch names the list; its name is said only. */}
				<h2 id="need" className="sr-only">
					groceries
				</h2>
				<div className="flex-1" />
				{/* The list's actions, always in place so the list never shifts:
				    changing it, and clearing what is already in the kitchen,
				    greyed while there is none. */}
				{editButton}
				<button
					type="button"
					disabled={!inCart.length}
					onClick={clear}
					className={buttonVariants({ variant: 'outline', className: 'px-3' })}
				>
					clear
				</button>
			</div>
			{items.length ? list : null}
			{items.length || composer.open ? null : (
				<button
					type="button"
					onClick={composer.start}
					className="border-foreground/30 text-muted-foreground hover:text-foreground flex min-h-12 items-center gap-3 rounded-xl border border-dashed px-3 text-left text-base transition-colors"
				>
					<span className="border-foreground/40 grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed">
						<PlusIcon size={12} weight="bold" aria-hidden />
					</span>
					nothing on your list — add an item
				</button>
			)}
			{adding}
			{children}
			{sheet}
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
	heading: Heading,
	items,
	row,
	action,
}: {
	label: string
	heading: 'h2' | 'h3'
	items: Item[]
	row: (item: Item) => React.ReactNode
	action?: React.ReactNode
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
				<Heading className="text-muted-foreground flex items-center justify-between gap-2 pb-1 text-sm font-bold">
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
					{action}
				</Heading>
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
							<ul className="bg-background border-border divide-border divide-y rounded-xl border">
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

// A row on the list: all of it ticks, and in the shop it is a target a thumb
// finds without looking. Changing the item is for edit. The note says why
// it is wanted, when the kitchen knows.
function GroceryRow({
	item,
	note,
	fresh,
	onCheck,
}: {
	item: Item
	note: React.ReactNode
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
				className={cn(
					'hover:bg-muted/40 flex cursor-pointer items-center transition-colors',
					'min-h-15 gap-3.5 px-4',
				)}
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
						'min-w-0 flex-1 py-2',
						'text-lg',
						checked && 'text-muted-foreground line-through',
					)}
				>
					{item.text}
				</span>
				{checked ? null : note}
			</label>
		</motion.li>
	)
}

// The list to change: each item's name to retype, its amount a step up or
// down, and a cross to take it off, by aisle.
function PlanList({
	items,
	heading: Heading,
	onChange,
	onUnits,
	onRemove,
}: {
	items: Item[]
	heading: 'h2' | 'h3'
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
					<Heading className="text-muted-foreground pb-1 text-sm font-bold">
						{group.label}
					</Heading>
					<ul className="bg-background border-border divide-border divide-y rounded-xl border">
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
