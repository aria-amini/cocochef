import {
	CaretDownIcon,
	CheckIcon,
	MinusIcon,
	PencilSimpleIcon,
	PlusIcon,
	ShoppingCartIcon,
	TrashIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
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
import { BrandField, WithBrand } from '@/components/brand-field'
import { FoodPicture } from '@/components/food-picture'
import { groceryCountKey } from '@/components/grocery-badge'
import { useGroceryComposer } from '@/components/grocery-entry'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { RecipeMenu } from '@/components/recipe-menu'
import { TickBox } from '@/components/tick-box'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { undoToast } from '@/components/undo-toast'
import { shoppingUnitsFor, stepShopping } from '@/lib/groceries/amounts'
import { pantryNameOf } from '@/lib/groceries/list'
import { sameItem, type GroceryInput } from '@/lib/groceries/model'
import {
	addGroceries,
	clearCheckedGroceries,
	deleteGrocery,
	listGroceries,
	renameGrocery,
	restoreCart,
	setGroceryBrand,
	setGroceryChecked,
} from '@/lib/groceries/server'
import { pantryCategoryLabels, type PantryCategory } from '@/lib/pantry/model'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { amountOf, withAmount } from '@/lib/recipes/ingredient-line'
import { count } from '@/lib/utils/count'
import { cn } from '@/lib/utils/ui'

export type GroceryItem = NonNullable<
	Awaited<ReturnType<typeof listGroceries>>
>[number]

type Item = GroceryItem

type Change =
	| { kind: 'add'; items: Item[] }
	| { kind: 'check'; id: string; checked: boolean }
	| { kind: 'rename'; id: string; text: string }
	| { kind: 'brand'; id: string; brand: string | null }
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
		case 'brand':
			return items.map((item) =>
				item.id === change.id ? { ...item, brand: change.brand } : item,
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
	brand: null,
	recipes: [],
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
	const reduceMotion = useReducedMotion()
	const [picked, setSorting] = useSorting()
	// Sorting by recipe needs a recipe to sort by; until one is on the list,
	// it's by aisle and there's nothing to switch.
	const sortable = items.some((item) => item.recipes.length)
	const sorting = sortable ? picked : 'aisle'
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

			// A read already on its way started before this change, so it waits
			// for that one and reads again, and for the fresh read itself
			// (sync), so the tick shown stays until it lands.
			await router.latestLoadPromise?.catch(() => undefined)
			await Promise.all([
				router.invalidate({ sync: true }).catch(() => undefined),
				client.invalidateQueries({ queryKey: groceryCountKey }),
			])
		})
	}

	// A tick only puts the item in the cart. The kitchen hears about it when
	// the cart is cleared.
	function check(item: Item, checked: boolean) {
		hold()
		change({ kind: 'check', id: item.id, checked }, async () => {
			await setGroceryChecked({ data: { id: item.id, checked } })
		})
	}

	// Putting away is one tap: what is in the cart goes into the kitchen, and
	// the toast can take it back, the list and the pantry as they were.
	function putAway() {
		change({ kind: 'clear' }, async () => {
			const done = await clearCheckedGroceries()
			const put = done.restocked + done.added

			undoToast(
				put
					? `put ${count(put, 'item', 'items')} away in on hand`
					: 'cleared your cart',
				() =>
					change({ kind: 'add', items: inCart }, async () => {
						await restoreCart({ data: done.undo })
					}),
				'put-away',
			)
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

		const input: GroceryInput = {
			id: back.id,
			text: back.text,
			brand: back.brand,
		}

		if (back.recipes.length)
			input.recipeIds = back.recipes.map((recipe) => recipe.id)

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

	function brand(item: Item, next: string | null) {
		change({ kind: 'brand', id: item.id, brand: next }, async () => {
			await setGroceryBrand({ data: { id: item.id, brand: next ?? '' } })
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

	// By recipe, a food two recipes share sits under the first, and says the
	// rest.
	const also = (item: Item) =>
		sorting === 'recipe' && item.recipes.length > 1 ? (
			<span className="text-muted-foreground shrink-0 text-xs font-semibold">
				also for{' '}
				{item.recipes
					.slice(1)
					.map((recipe) => recipe.title)
					.join(', ')}
			</span>
		) : null

	const row = (item: Item) => (
		<GroceryRow
			key={item.id}
			item={item}
			note={
				<>
					{noteOf?.(item)}
					{also(item)}
				</>
			}
			fresh={item.id === fresh}
			onCheck={(checked) => check(item, checked)}
			onRemove={() => remove(item)}
		/>
	)

	// The aisles sit under the list's own heading.
	const heading = 'h3'

	// Changing the list is folded behind "⋯"; while it's being changed, done
	// takes its place.
	const editButton = editing ? (
		<button
			type="button"
			onClick={() => setEditing(false)}
			className={buttonVariants({
				variant: 'ghost',
				size: 'lg',
			})}
		>
			<CheckIcon size={14} weight="bold" aria-hidden />
			done
		</button>
	) : (
		<RecipeMenu
			label="list options"
			items={[
				{
					key: 'edit',
					label: 'edit list',
					icon: PencilSimpleIcon,
					onSelect: () => setEditing(true),
				},
			]}
		/>
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
			<div className="flex flex-col">
				<AnimatePresence initial={false}>
					{(sorting === 'recipe'
						? byRecipe(toFind)
						: shelved(toFind).map(({ category, items: aisle }) => ({
								key: category,
								label: pantryCategoryLabels[category],
								items: aisle,
							}))
					).map((group) => (
						<ListBox
							key={group.key}
							label={group.label}
							heading={heading}
							items={group.items}
							row={row}
						/>
					))}
					{completed.length ? (
						<ListBox
							key="completed"
							label="in your cart"
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
	// the add row in its place. One place and one wording whatever the list
	// holds, so it keeps focus as the first item lands.
	const adding = (
		<>
			{composer.draft}
			{composer.open ? null : (
				<button
					type="button"
					onClick={composer.start}
					className="border-foreground/30 text-muted-foreground hover:text-foreground hover:border-input flex min-h-12 items-center gap-3 rounded-xl border border-dashed px-3 text-left text-base transition-colors"
				>
					<span className="border-foreground/40 grid size-6 shrink-0 place-items-center rounded-full border-2 border-dashed">
						<PlusIcon size={12} weight="bold" aria-hidden />
					</span>
					add grocery item
				</button>
			)}
		</>
	)

	const sheet = sheetItem ? (
		<GroceryDetails
			key={sheetItem.id}
			item={sheetItem}
			onRename={(text) => rename(sheetItem, text)}
			onBrand={(next) => brand(sheetItem, next)}
			onRemove={() => {
				setOpenId(undefined)
				remove(sheetItem)
			}}
			onClose={() => setOpenId(undefined)}
		/>
	) : null

	return (
		// The page is the list: its aisles sit straight on the paper, each one
		// box of rows, with nothing boxed around them.
		<section aria-labelledby="need" className="flex flex-col gap-3">
			<div className="flex min-h-10 flex-wrap items-center gap-2">
				{/* The kitchen's switch names the list; its name is said only. */}
				<h2 id="need" className="sr-only">
					groceries
				</h2>
				<GroceryProgress done={inCart.length} total={items.length} />
				{/* Only once there's a list to edit. The row keeps its height
				    either way: the button reaches past it, as tall as a touch
				    target, without making it taller. */}
				{items.length || editing ? (
					<div className="-my-0.5">{editButton}</div>
				) : null}
			</div>
			<GroceryBar done={inCart.length} total={items.length} />
			{/* The sort switch and the aisles grow in under the title as the
			    first item, or the first for a recipe, lands, rather than dropping in. They space themselves,
			    so nothing jumps by a gap as they come. */}
			{/* The add row follows the aisles with no gap of its own: they
			    space themselves, so an empty list's add row sits as close under
			    the title as a full list's first aisle, and the first item's
			    aisle grows in above it without a jump. */}
			<div className="flex flex-col">
				<div className="flex flex-col">
					<AnimatePresence initial={false}>
						{sortable ? (
							<motion.div
								key="sort"
								initial={reduceMotion ? false : { opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								transition={{
									duration: reduceMotion ? 0 : 0.25,
									ease: 'easeOut',
								}}
								className="overflow-hidden"
							>
								{/* Editing hides it but keeps its room. */}
								<SortSwitch
									sorting={sorting}
									onSort={setSorting}
									hidden={editing}
								/>
								<div className="h-3" />
							</motion.div>
						) : null}
					</AnimatePresence>
					{list}
				</div>
				{adding}
			</div>
			{children}
			{sheet}
			<AnimatePresence initial={false}>
				{inCart.length && !editing ? (
					<PutAwayBar
						key="put-away"
						count={inCart.length}
						onPutAway={putAway}
					/>
				) : null}
			</AnimatePresence>
		</section>
	)
}

// What is in the cart, and the one tap that puts it away: over the tab bar on
// a phone, in thumb's reach, and at the foot of the list on a desk. Home from
// the shop, it is the whole of the cook's part; the toast takes it back.
function PutAwayBar({
	count: inCart,
	onPutAway,
}: {
	count: number
	onPutAway: () => void
}) {
	const reduceMotion = useReducedMotion()

	return (
		<motion.div
			initial={reduceMotion ? false : { opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			exit={
				reduceMotion
					? { opacity: 0, transition: { duration: 0 } }
					: { opacity: 0, y: 16 }
			}
			transition={{ duration: 0.2, ease: 'easeOut' }}
			className="bottom-fab bg-card floating sticky z-10 flex items-center gap-3 p-2 pl-4 md:bottom-4"
		>
			<p className="min-w-0 flex-1 text-sm font-semibold tabular-nums">
				{inCart} in your cart
			</p>
			<Button onClick={onPutAway}>
				<CheckIcon weight="bold" aria-hidden />
				put away
			</Button>
		</motion.div>
	)
}

// The list's name, with the tab's cart beside it. How far the shop is goes
// unsaid but for the bar under it, and is said for screen readers.
function GroceryProgress({ done, total }: { done: number; total: number }) {
	return (
		<p className="flex flex-1 items-center gap-2 text-lg font-bold">
			<ShoppingCartIcon size={20} weight="bold" aria-hidden />
			grocery list
			{done ? (
				<span className="sr-only">
					, {done} of {total} in your cart
				</span>
			) : null}
		</p>
	)
}

// How far the shop is, across the list's width, once anything is ticked.
function GroceryBar({ done, total }: { done: number; total: number }) {
	if (!done || !total) return null

	const filled: React.CSSProperties & Record<`--${string}`, string> = {
		'--done': `${(done / total) * 100}%`,
	}

	return (
		<span
			aria-hidden
			className="bg-foreground/10 -mt-1 block h-1.5 w-full overflow-hidden rounded-full"
		>
			<span
				className="bg-kitchen-basil block h-full w-(--done) rounded-full transition-all duration-300"
				style={filled}
			/>
		</span>
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

// The list sorted the way the shop walks it, by aisle, or by what each item
// is for, a recipe at a time. Remembered on this device.
type Sorting = 'aisle' | 'recipe'

const sortingKey = 'groceries-sorting'

const sortingListeners = new Set<() => void>()

function readSorting(): Sorting {
	try {
		return localStorage.getItem(sortingKey) === 'recipe' ? 'recipe' : 'aisle'
	} catch {
		// No storage: by aisle.
		return 'aisle'
	}
}

// The server draws it by aisle; the browser reads what was picked last.
function useSorting() {
	const sorting = useSyncExternalStore(
		(listener) => {
			sortingListeners.add(listener)

			return () => sortingListeners.delete(listener)
		},
		readSorting,
		() => 'aisle' as const,
	)

	const sort = (next: Sorting) => {
		try {
			localStorage.setItem(sortingKey, next)
		} catch {
			// Not kept; the switch still moves for this visit.
		}

		sortingListeners.forEach((listener) => listener())
	}

	return [sorting, sort] as const
}

// Each recipe the list holds food for, in the order its food came, then
// what was added by hand. A food for two recipes sits under the first.
function byRecipe(items: Item[]) {
	const groups = new Map<
		string,
		{ key: string; label: string; items: Item[] }
	>()

	const byHand: Item[] = []

	for (const item of [...items].sort(
		(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
	)) {
		const recipe = item.recipes[0]

		if (!recipe) {
			byHand.push(item)
			continue
		}

		const group = groups.get(recipe.id) ?? {
			key: recipe.id,
			label: recipe.title,
			items: [],
		}

		group.items.push(item)
		groups.set(recipe.id, group)
	}

	return [
		...groups.values(),
		...(byHand.length
			? [{ key: 'other', label: 'no recipe', items: byHand }]
			: []),
	]
}

// The two ways to sort, as the recipe page's steps are: words with a line
// under the one showing.
function SortSwitch({
	sorting,
	onSort,
	hidden = false,
}: {
	sorting: Sorting
	onSort: (sorting: Sorting) => void
	hidden?: boolean
}) {
	const option = (value: Sorting, label: string) => (
		<button
			type="button"
			aria-pressed={sorting === value}
			onClick={() => onSort(value)}
			className={cn(
				'-mb-px inline-flex min-h-9 items-center border-b-2 text-sm font-semibold transition-colors',
				sorting === value
					? 'border-foreground text-foreground font-bold'
					: 'text-muted-foreground hover:text-foreground border-transparent',
			)}
		>
			{label}
		</button>
	)

	return (
		<fieldset
			inert={hidden}
			className={cn(
				'flex items-center justify-center gap-6',
				hidden && 'invisible',
			)}
		>
			<legend className="sr-only">sort by</legend>
			{option('aisle', 'by aisle')}
			{option('recipe', 'by recipe')}
		</fieldset>
	)
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
						className="hover:text-foreground -mx-1 inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md px-1 text-left transition-colors"
					>
						{/* A recipe's name can run long: one line, cut short. */}
						<span className="truncate">{label}</span>
						{open ? null : (
							<span className="font-semibold tabular-nums">
								· {items.length}
							</span>
						)}
						<CaretDownIcon
							size={12}
							weight="bold"
							aria-hidden
							className={cn(
								'shrink-0 transition-transform',
								open && 'rotate-180',
							)}
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

// How far a row slides left before letting go takes it off the list.
const swipeAway = 96

// A row on the list: all of it ticks, and in the shop it is a target a thumb
// finds without looking. Swiped left, it comes off the list, bought or not,
// so it never reaches the pantry; the toast brings it back. Changing the
// item is for edit. The note says why it is wanted, when the kitchen knows.
function GroceryRow({
	item,
	note,
	fresh,
	onCheck,
	onRemove,
}: {
	item: Item
	note: React.ReactNode
	fresh: boolean
	onCheck: (checked: boolean) => void
	onRemove: () => void
}) {
	const reduceMotion = useReducedMotion()
	const checked = !!item.checkedAt
	const look = ingredientItemLook(item.text)
	const [swiping, setSwiping] = useState(false)
	// A swipe ends on the row it started on, which would tick it too.
	const swiped = useRef(false)

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
			className="relative scroll-my-6 overflow-hidden first:rounded-t-xl last:rounded-b-xl"
		>
			{/* What letting go does, under the row as it slides. */}
			{swiping ? (
				<span
					aria-hidden
					className="bg-kitchen-tomato absolute inset-0 flex items-center justify-end gap-2 pr-5 text-sm font-bold"
				>
					<TrashIcon size={18} weight="bold" />
					remove
				</span>
			) : null}
			<motion.div
				drag="x"
				dragDirectionLock
				dragConstraints={{ left: 0, right: 0 }}
				dragElastic={{ left: 0.8, right: 0 }}
				dragSnapToOrigin
				onDragStart={() => {
					swiped.current = true
					setSwiping(true)
				}}
				onDragEnd={(_, info) => {
					setSwiping(false)

					if (info.offset.x < -swipeAway || info.velocity.x < -800) onRemove()
				}}
				onClickCapture={(event) => {
					if (!swiped.current) return

					swiped.current = false
					event.preventDefault()
					event.stopPropagation()
				}}
				className={cn(
					// Up and down still scrolls the page.
					'bg-card relative touch-pan-y transition-colors duration-700',
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
						{look ? (
							<FoodPicture
								food={pantryNameOf(item.text)}
								brand={item.brand}
								look={look}
								className="size-7"
							/>
						) : null}
					</span>
					<span
						className={cn(
							'min-w-0 flex-1 py-2',
							'text-lg',
							checked && 'text-muted-foreground line-through',
						)}
					>
						<WithBrand name={item.text} brand={item.brand} />
					</span>
					{checked ? null : note}
				</label>
			</motion.div>
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
		<div className="flex flex-col">
			{groups.map((group) => (
				<section key={group.key} aria-label={group.label} className="pb-5">
					{/* As tall as the folding headings out of editing, so the list
					    holds still between the two. */}
					<Heading className="text-muted-foreground flex min-h-11 items-center pb-1 text-sm font-bold">
						{group.label}
					</Heading>
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
		<li data-grocery={item.id} className="min-h-14 py-1.5 pr-1.5 pl-3">
			<div className="flex items-center gap-2">
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
			</div>
			<ForRecipes recipes={item.recipes} className="pb-1 pl-9" />
		</li>
	)
}

// The recipes a line is for, each a way back to it. In the shop the row stays
// the food's name alone; the reason is here, where the list is changed.
function ForRecipes({
	recipes,
	onNavigate,
	className,
}: {
	recipes: Item['recipes']
	onNavigate?: () => void
	className?: string
}) {
	if (!recipes.length) return null

	return (
		<p className={cn('text-muted-foreground text-sm font-semibold', className)}>
			for{' '}
			{recipes.map((recipe, index) => (
				<span key={recipe.id}>
					{index ? ', ' : ''}
					<Link
						to="/recipes/$recipeId"
						params={{ recipeId: recipe.id }}
						onClick={onNavigate}
						className="hover:text-foreground underline underline-offset-2 transition-colors"
					>
						{recipe.title}
					</Link>
				</span>
			))}
		</p>
	)
}

// One item up close: its amount in a shop's units, its name, the recipe it
// is for, and deleting it. A change is kept as it closes, unless escape
// takes it back.
function GroceryDetails({
	item,
	onRename,
	onBrand,
	onRemove,
	onClose,
}: {
	item: Item
	onRename: (text: string) => void
	onBrand: (brand: string | null) => void
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
			<ForRecipes recipes={item.recipes} onNavigate={() => finish()} />
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
				<BrandField
					food={text}
					brand={item.brand}
					onBrand={onBrand}
					className="ml-10 w-auto"
				/>
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
