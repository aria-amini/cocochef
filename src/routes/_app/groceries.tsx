import {
	CheckIcon,
	ExportIcon,
	PlusIcon,
	ShoppingCartIcon,
	TrashIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
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

import { groceryCountKey } from '@/components/grocery-badge'
import { GroceryField, useGroceryComposer } from '@/components/grocery-entry'
import { PantrySprite } from '@/components/pantry-sprite'
import { PutAway } from '@/components/put-away'
import { buttonVariants } from '@/components/ui/button'
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
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/groceries')({
	// Adding floats above the tab bar on phones, as on the other tabs.
	staticData: { tabBar: 'own-fab' },
	loader: () => listGroceries(),
	component: Groceries,
})

type Item = Awaited<ReturnType<typeof listGroceries>>[number]

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
		case 'add':
			return [...items, ...change.items]
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
	createdAt: new Date(),
})

// One list for the shop: what is left, shelved by aisle, and what is already
// in the cart below it. Recipes add to it; anything else is typed in.
function Groceries() {
	const router = useRouter()
	const client = useQueryClient()
	const saved = Route.useLoaderData()
	const [items, apply] = useOptimistic(saved, applyChange)
	const [puttingAway, setPuttingAway] = useState(false)
	// Select mode: tap rows to pick them, then act on them all at once.
	const [selecting, setSelecting] = useState(false)
	const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
	// The item just added, lit for a moment so the eye finds its aisle.
	const [fresh, setFresh] = useState<string>()

	useEffect(() => {
		if (!fresh) return
		const timer = setTimeout(() => setFresh(undefined), 1500)

		return () => clearTimeout(timer)
	}, [fresh])

	const waiting = items.filter((item) => !item.checkedAt)
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
				toast.error('could not update the list. try again')
			}

			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: groceryCountKey }),
			])
		})
	}

	function add(text: string) {
		// An item already waiting is not added twice, here or on the server.
		if (waiting.some((item) => sameItem(item.text) === sameItem(text))) {
			toast('already on your list')

			return
		}

		const draft = draftItem(text)

		setFresh(draft.id)
		change({ kind: 'add', items: [draft] }, async () => {
			await addGroceries({ data: [{ id: draft.id, text }] })
		})
	}

	const composer = useGroceryComposer(add)
	const cartRef = useRef<HTMLElement>(null)
	const reduceMotion = useReducedMotion()
	const field = useRef<HTMLTextAreaElement>(null)

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

	function removeAll(gone: Item[]) {
		for (const item of gone)
			change({ kind: 'remove', id: item.id }, async () => {
				await deleteGrocery({ data: { id: item.id } })
			})

		// A slip of the thumb is one tap from undone.
		toast(
			gone.length === 1 ? `removed ${gone[0]?.text}` : `removed ${gone.length}`,
			{
				action: {
					label: 'undo',
					onClick: () => {
						for (const item of gone) restore(item)
					},
				},
			},
		)
	}

	function checkAll(bought: Item[]) {
		for (const item of bought)
			change({ kind: 'check', id: item.id, checked: true }, async () => {
				await setGroceryChecked({ data: { id: item.id, checked: true } })
			})
	}

	function stopSelecting() {
		setSelecting(false)
		setPicked(new Set())
	}

	const chosen = items.filter((item) => picked.has(item.id))

	const actions = (
		<ItemActions
			count={chosen.length}
			onBought={() => {
				checkAll(chosen.filter((item) => !item.checkedAt))
				stopSelecting()
			}}
			onRemove={() => {
				removeAll(chosen)
				stopSelecting()
			}}
		/>
	)

	const row = (item: Item) => (
		<GroceryRow
			key={item.id}
			item={item}
			fresh={item.id === fresh}
			onCheck={(checked) =>
				change({ kind: 'check', id: item.id, checked }, async () => {
					await setGroceryChecked({ data: { id: item.id, checked } })
				})
			}
			onRename={(text) =>
				change({ kind: 'rename', id: item.id, text }, async () => {
					await renameGrocery({ data: { id: item.id, text } })
				})
			}
			onRemove={() => removeAll([item])}
			selecting={selecting}
			picked={picked.has(item.id)}
			onPick={(on) =>
				setPicked((now) => {
					const next = new Set(now)

					if (on) next.add(item.id)
					else next.delete(item.id)

					return next
				})
			}
		/>
	)

	return (
		<main className="flex-1">
			<div className="flex max-w-2xl flex-col gap-6 p-6 md:p-10">
				{/* The sidebar says where you are; the page opens on what is left. */}
				<h1 className="sr-only">groceries</h1>
				{/* Ticked items move down into the cart, which says how the shop
				    goes. Once all of it is there, the trip ends here. */}
				{items.length ? (
					selecting ? (
						<SelectBar
							count={chosen.length}
							all={chosen.length === items.length}
							onAll={(on) =>
								setPicked(new Set(on ? items.map((item) => item.id) : []))
							}
							onDone={stopSelecting}
							actions={actions}
						/>
					) : (
						<div className="bg-background/90 sticky top-0 z-20 -mx-2 flex items-center justify-end gap-1 px-2 py-1 backdrop-blur-sm">
							{/* How the shop goes, at a glance while scrolling: a tap goes to
							    the cart. */}
							{inCart.length ? (
								<button
									type="button"
									aria-label={`${inCart.length} in the cart: go to the cart`}
									onClick={() =>
										cartRef.current?.scrollIntoView({
											behavior: reduceMotion ? 'auto' : 'smooth',
											block: 'start',
										})
									}
									className="text-muted-foreground hover:text-foreground mr-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold transition-colors"
								>
									<ShoppingCartIcon size={16} weight="bold" aria-hidden />
									<motion.span
										key={inCart.length}
										initial={reduceMotion ? false : { scale: 1.4 }}
										animate={{ scale: 1 }}
										className="text-foreground inline-block tabular-nums"
									>
										{inCart.length}
									</motion.span>
									in the cart
								</button>
							) : null}
							<ShareList items={waiting.map((item) => item.text)} />
							<button
								type="button"
								onClick={() => setSelecting(true)}
								className={buttonVariants({
									variant: 'ghost',
									className: 'px-2.5',
								})}
							>
								edit
							</button>
						</div>
					)
				) : null}
				{!selecting && !waiting.length && inCart.length ? (
					<section
						aria-labelledby="all-in-cart"
						className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4"
					>
						<div className="flex min-w-0 flex-1 flex-col">
							<h2 id="all-in-cart" className="text-base font-bold">
								all in the cart
							</h2>
							<p className="text-muted-foreground text-sm font-semibold">
								put it away, and your ingredients keep up
							</p>
						</div>
						<button
							type="button"
							onClick={() => setPuttingAway(true)}
							className={buttonVariants({ className: 'min-h-11' })}
						>
							put away
						</button>
					</section>
				) : null}
				{selecting ? null : (
					<>
						<GroceryField onAdd={add} inputRef={field} />
						{/* The plus waits for items: an empty list has its own way in. */}
						{items.length ? composer.button : null}
					</>
				)}
				{waiting.length ? (
					<div className="flex flex-col gap-5">
						{shelved(waiting).map(({ category, items: aisle }) => (
							<section
								key={category}
								aria-label={pantryCategoryLabels[category]}
							>
								<h2 className="text-muted-foreground px-1 pb-1 text-sm font-bold">
									{pantryCategoryLabels[category]}
								</h2>
								<ul className="bg-card border-input divide-border divide-y rounded-xl border">
									<AnimatePresence initial={false}>
										{aisle.map(row)}
									</AnimatePresence>
								</ul>
							</section>
						))}
					</div>
				) : null}
				{items.length || composer.open ? null : (
					<EmptyList
						// The field over the list where there is one; on a phone, the
						// row the plus would open.
						onAdd={() => {
							if (field.current?.offsetParent) field.current.focus()
							else composer.start()
						}}
					/>
				)}
				{/* One place whatever the list holds, so it keeps focus as the
				    first item lands. */}
				{composer.draft}
				{inCart.length ? (
					<section
						ref={cartRef}
						aria-label="in the cart"
						className="flex scroll-mt-16 flex-col gap-1"
					>
						<div className="flex items-center justify-between px-1">
							<h2 className="text-muted-foreground text-sm font-bold">
								in the cart · {inCart.length}
							</h2>
							{/* Mid-trip, what is bought can go away early. */}
							{waiting.length ? (
								<button
									type="button"
									onClick={() => setPuttingAway(true)}
									className={buttonVariants({
										variant: 'ghost',
										size: 'icon-sm',
										className: 'w-auto px-2.5',
									})}
								>
									put away
								</button>
							) : null}
						</div>
						<ul className="divide-border border-input divide-y rounded-xl border border-dashed">
							<AnimatePresence initial={false}>
								{inCart.map(row)}
							</AnimatePresence>
						</ul>
					</section>
				) : null}
				{puttingAway ? (
					<PutAway
						items={inCart}
						onClear={() =>
							change({ kind: 'clear' }, async () => {
								await clearCheckedGroceries()
							})
						}
						onClose={() => setPuttingAway(false)}
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
			className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border p-10 text-center"
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

function shelved(items: Item[]) {
	return aisles.flatMap((category) => {
		const aisle = items.filter((item) => item.category === category)

		return aisle.length ? [{ category, items: aisle }] : []
	})
}

function GroceryRow({
	item,
	fresh,
	onCheck,
	onRename,
	onRemove,
	selecting,
	picked,
	onPick,
}: {
	item: Item
	fresh: boolean
	onCheck: (checked: boolean) => void
	onRename: (text: string) => void
	onRemove: () => void
	selecting: boolean
	picked: boolean
	onPick: (on: boolean) => void
}) {
	const reduceMotion = useReducedMotion()
	// A tick shows on the row for a moment before it moves to or from the
	// cart, so the eye sees what happened.
	const [ticking, setTicking] = useState<boolean>()
	const checked = ticking ?? !!item.checkedAt

	function tick(on: boolean) {
		if (reduceMotion) {
			onCheck(on)

			return
		}

		setTicking(on)
		setTimeout(() => onCheck(on), 450)
	}

	const look = ingredientItemLook(item.text)
	const field = useRef<HTMLInputElement>(null)
	const rowRef = useRef<HTMLLIElement>(null)

	// On a touch screen the row slides left to uncover delete.
	const coarse = useSyncExternalStore(
		subscribeCoarse,
		() => matchMedia('(pointer: coarse)').matches,
		() => false,
	)

	const reveal = 88
	const x = useMotionValue(0)
	const [open, setOpen] = useState(false)
	const dragged = useRef(false)

	function settle(next: boolean) {
		setOpen(next)
		void animate(x, next ? -reveal : 0, {
			type: 'spring',
			stiffness: 500,
			damping: 40,
		})
	}

	// A new item may land in an aisle off screen: bring it into view.
	useEffect(() => {
		if (fresh) rowRef.current?.scrollIntoView({ block: 'nearest' })
	}, [fresh])

	function rename(text: string) {
		const trimmed = text.trim()

		if (!trimmed) {
			if (field.current) field.current.value = item.text

			return
		}

		if (trimmed !== item.text) onRename(trimmed)
	}

	// Editing, the box and picture pick the row and its name can be renamed;
	// outside editing a name is only read, so a tap never opens a keyboard.
	if (selecting)
		return (
			<li
				className={cn(
					'flex min-h-13 items-center gap-3 pr-3 pl-3 transition-colors',
					picked && 'bg-kitchen-yolk/30',
				)}
			>
				<label className="flex shrink-0 cursor-pointer items-center gap-3 self-stretch">
					<input
						type="checkbox"
						aria-label={`select ${item.text}`}
						checked={picked}
						onChange={(event) => onPick(event.target.checked)}
						className="accent-kitchen-eggplant size-5 shrink-0"
					/>
					<span aria-hidden className="grid size-6 shrink-0 place-items-center">
						{look ? <PantrySprite look={look} className="size-6" /> : null}
					</span>
				</label>
				<input
					ref={field}
					key={item.text}
					aria-label={`rename ${item.text}`}
					defaultValue={item.text}
					maxLength={200}
					onBlur={(event) => rename(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur()

						if (event.key === 'Escape') {
							event.currentTarget.value = item.text
							event.currentTarget.blur()
						}
					}}
					className={cn(
						'border-input focus:border-foreground/40 min-h-10 w-full min-w-0 flex-1 rounded-md border border-dashed bg-transparent px-2 text-base outline-none',
						checked && 'text-muted-foreground line-through',
					)}
				/>
			</li>
		)

	return (
		<motion.li
			ref={rowRef}
			// A ticked item travels from its aisle down into the cart, and back up
			// when unticked, while the rows around it close the gap: the eye
			// follows where it went. One that leaves the list for good fades.
			// With reduced motion it moves at once.
			layout
			layoutId={item.id}
			initial={reduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeInOut' }}
			className={cn(
				'relative z-10 scroll-my-32 overflow-hidden transition-colors duration-700 first:rounded-t-xl last:rounded-b-xl',
				fresh && 'bg-kitchen-yolk/30',
			)}
		>
			{/* Uncovered by a swipe to the left, so deleting takes two moves. */}
			<button
				type="button"
				inert={!open}
				onClick={onRemove}
				className="bg-kitchen-tomato text-foreground absolute inset-y-0 right-0 w-22 text-sm font-bold"
			>
				delete
			</button>
			<motion.div
				drag={coarse ? 'x' : false}
				dragDirectionLock
				dragConstraints={{ left: -reveal, right: 0 }}
				dragElastic={0.1}
				onDragStart={() => {
					dragged.current = true
				}}
				onDragEnd={() => settle(x.get() < -reveal / 2)}
				// A swipe is not a tap, and while open a tap on the row closes it
				// instead of ticking it.
				onClickCapture={(event) => {
					if (!open && !dragged.current) return
					event.preventDefault()
					event.stopPropagation()

					if (!dragged.current) settle(false)
					dragged.current = false
				}}
				// A motion value only moves the row through style.
				// oxlint-disable-next-line shadcn/no-inline-styles
				style={{ x }}
				className={cn(
					'relative flex items-center pl-3',
					checked ? 'bg-background' : 'bg-card',
				)}
			>
				{/* The whole row ticks it, not only the circle. */}
				<label className="flex min-h-13 min-w-0 flex-1 cursor-pointer items-center gap-3 pr-3">
					<input
						type="checkbox"
						aria-label={item.text}
						checked={checked}
						onChange={(event) => tick(event.target.checked)}
						className={cn(
							'border-foreground/40 grid size-6 shrink-0 cursor-pointer appearance-none place-items-center rounded-full border-2 transition-colors',
							'checked:bg-kitchen-basil checked:border-kitchen-basil',
							"checked:after:text-foreground checked:after:text-xs checked:after:font-bold checked:after:content-['✓']",
						)}
					/>
					<span aria-hidden className="grid size-6 shrink-0 place-items-center">
						{look ? <PantrySprite look={look} className="size-6" /> : null}
					</span>
					<span
						className={cn(
							'min-w-0 flex-1 py-2 text-base',
							checked && 'text-muted-foreground line-through',
						)}
					>
						{item.text}
					</span>
				</label>
			</motion.div>
		</motion.li>
	)
}

const subscribeCoarse = (notify: () => void) => {
	const query = matchMedia('(pointer: coarse)')
	query.addEventListener('change', notify)

	return () => query.removeEventListener('change', notify)
}

// Editing's header, in place of the list's, held at the top while the list
// scrolls: a box to select all (half ticked when some are), how many are
// picked, and done. Once anything is picked, what to do with it shows
// right under it.
function SelectBar({
	count,
	all,
	onAll,
	onDone,
	actions,
}: {
	count: number
	all: boolean
	onAll: (on: boolean) => void
	onDone: () => void
	actions: React.ReactNode
}) {
	return (
		<div
			role="toolbar"
			aria-label="editing"
			className="border-border bg-card sticky top-2 z-20 flex flex-col gap-1 rounded-xl border p-1.5"
		>
			<div className="flex items-center gap-2 pl-1.5">
				<label className="flex min-h-10 flex-1 cursor-pointer items-center gap-3 text-sm font-bold">
					<input
						type="checkbox"
						checked={all}
						ref={(node) => {
							if (node) node.indeterminate = count > 0 && !all
						}}
						onChange={(event) => onAll(event.target.checked)}
						className="accent-kitchen-eggplant size-5 shrink-0"
					/>
					select all
					<span
						aria-live="polite"
						className="text-muted-foreground font-semibold"
					>
						{count ? `· ${count} selected` : ''}
					</span>
				</label>
				<button
					type="button"
					onClick={onDone}
					className={buttonVariants({ variant: 'ghost', className: 'px-2.5' })}
				>
					done
				</button>
			</div>
			{count ? (
				<div className="border-border border-t pt-1">{actions}</div>
			) : null}
		</div>
	)
}

// What editing does to the picked items: buy them, or delete them.
function ItemActions({
	count,
	onBought,
	onRemove,
}: {
	count: number
	onBought: () => void
	onRemove: () => void
}) {
	const action = buttonVariants({
		variant: 'ghost',
		className: 'flex-1 gap-1.5 px-2.5',
	})

	return (
		<div className="flex items-center gap-1">
			<button
				type="button"
				disabled={!count}
				onClick={onBought}
				className={action}
			>
				<CheckIcon size={16} weight="bold" aria-hidden />
				bought
			</button>
			<button
				type="button"
				disabled={!count}
				onClick={onRemove}
				className={action}
			>
				<TrashIcon size={16} weight="bold" aria-hidden />
				delete
			</button>
		</div>
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
					toast.error('could not share the list')
				}
			}}
			className={buttonVariants({ variant: 'outline' })}
		>
			<ExportIcon size={16} weight="bold" aria-hidden />
			share
		</button>
	)
}
