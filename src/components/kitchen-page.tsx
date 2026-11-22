import {
	CaretDownIcon,
	CaretRightIcon,
	CheckIcon,
	JarLabelIcon,
	Minus,
	Plus,
	SnowflakeIcon,
	TrashIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
	useEffect,
	useOptimistic,
	useRef,
	useState,
	useTransition,
} from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { BrandField, WithBrand } from '@/components/brand-field'
import { FoodPicture } from '@/components/food-picture'
import { groceryCountKey } from '@/components/grocery-badge'
import { GroceryList, type GroceryItem } from '@/components/grocery-list'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PendingPage } from '@/components/page-pending'
import { PantryNeed } from '@/components/pantry-need'
import { PantrySprite } from '@/components/pantry-sprite'
import { RecipeMenu } from '@/components/recipe-menu'
import { CartStepper, withAmountSaid } from '@/components/recipe-shop'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { undoToast } from '@/components/undo-toast'
import { groceryLinesKey } from '@/components/use-pantry'
import { stepShopping } from '@/lib/groceries/amounts'
import {
	addGroceries,
	deleteGrocery,
	listGroceries,
	renameGrocery,
} from '@/lib/groceries/server'
import { categorySprites } from '@/lib/pantry/catalog'
import { findInPantry, foodOf } from '@/lib/pantry/foods'
import { keepsAWhile } from '@/lib/pantry/kinds'
import {
	pantryCategoryLabels,
	pantryQuantityMax,
	type PantryCategory,
	type PantryLevel,
} from '@/lib/pantry/model'
import {
	deletePantryItem,
	listPantry,
	keepPantryItem,
	restockPantryItem,
	restorePantryItem,
	setPantryItemBrand,
	setPantryItemCount,
	setPantryItemFrozen,
	setPantryItemLevel,
} from '@/lib/pantry/server'
import { resolveSpriteLook } from '@/lib/pantry/sprites'
import { standardLook } from '@/lib/pantry/tinted-sprites'
import { cn } from '@/lib/utils/ui'

// A kitchen page's place: the item whose details are open.
export const kitchenSearch = z.object({
	item: z.string().optional(),
})

export type KitchenSearch = z.infer<typeof kitchenSearch>

// The kitchen's two pages, each a tab: the grocery list, and what is on hand.
export type KitchenView = 'groceries' | 'pantry'

const pathOf = { groceries: '/groceries', pantry: '/pantry' } as const

// What both pages read: what is in the kitchen, and the list of what it
// needs; null for a visitor, who keeps neither until they sign up.
export async function loadKitchen() {
	const [pantry, groceries] = await Promise.all([listPantry(), listGroceries()])

	return pantry && groceries ? { pantry, groceries } : null
}

type PantryItem = NonNullable<Awaited<ReturnType<typeof listPantry>>>[number]

// The kitchen on its way: a line for its heading over rows of food.
export function KitchenPending({ view }: { view: KitchenView }) {
	return (
		<PendingPage className="max-w-3xl gap-4 p-6 pb-28 md:p-10">
			<div className="flex min-h-10 items-center">
				<Skeleton kind="line" className="h-5 w-32" />
			</div>
			{/* The grocery list's sort switch, held for, so the list doesn't
			    drop when it lands. */}
			{view === 'groceries' ? (
				<div className="flex min-h-9 items-center justify-center gap-6">
					<Skeleton kind="line" className="h-4 w-16" />
					<Skeleton kind="line" className="h-4 w-18" />
				</div>
			) : null}
			<div className="flex flex-col gap-2">
				{Array.from({ length: view === 'groceries' ? 5 : 6 }, (_, i) => (
					<Skeleton key={i} kind="line" className="h-13 w-full" />
				))}
			</div>
		</PendingPage>
	)
}

// A pantry and a list are kept by an account; signed out, the page says so.
export function KitchenPage({
	view,
	loaded,
	search,
}: {
	view: KitchenView
	loaded: Awaited<ReturnType<typeof loadKitchen>>
	search: KitchenSearch
}) {
	if (loaded)
		return (
			<Pantry
				view={view}
				search={search}
				loaded={loaded.pantry}
				list={loaded.groceries}
			/>
		)

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 md:p-10">
				<h1 className="sr-only">{view}</h1>
				<SignUpToKeep
					picture={<PantryPreview />}
					title="keep track of your kitchen"
					body="sign up to note what you have, so recipes and groceries know it too"
				/>
			</div>
		</main>
	)
}

const dateFormat = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
})

const emptyPreview: PantryCategory[] = [
	'spices',
	'meat',
	'dairy',
	'vegetables',
	'fruit',
	'grains',
]

// A few of the pantry's shelves, for a pantry with nothing on them yet.
function PantryPreview() {
	return (
		<div aria-hidden className="flex gap-3">
			{emptyPreview.map((category) => (
				<PantrySprite
					key={category}
					look={standardLook({ key: categorySprites[category] })}
					className="size-10"
				/>
			))}
		</div>
	)
}

// Food going off within the week is worth using first; the week after is
// worth knowing about.
const weekDays = 7

const horizonDays = 14

function Pantry({
	view,
	search,
	loaded,
	list,
}: {
	view: KitchenView
	search: KitchenSearch
	loaded: PantryItem[]
	list: GroceryItem[]
}) {
	const navigate = useNavigate()
	const router = useRouter()
	const { item: selectedId } = search
	const here = pathOf[view]

	// A removed item leaves the list at once, and the pantry only once its
	// undo has passed.
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())

	// A level or count changed shows at the tap, until the kitchen is read
	// again.
	const [shown, patch] = useOptimistic(
		loaded,
		(now, change: { id: string; fields: Partial<PantryItem> }) =>
			now.map((item) =>
				item.id === change.id ? { ...item, ...change.fields } : item,
			),
	)

	const items = shown.filter((item) => !hidden.has(item.id))

	function show(id: string, on: boolean) {
		setHidden((now) => {
			const next = new Set(now)

			if (on) next.delete(id)
			else next.add(id)

			return next
		})
	}

	// Removed at once, on the server too, so it never comes back on its own;
	// undo puts it back as it was, dates and count and all.
	function remove(item: PantryItem) {
		show(item.id, false)
		// Back to the view it was removed from, so undo shows it there.
		void navigate({ to: here, search: {}, resetScroll: false })

		// The deletion alone, so undo still runs if only the refresh fails.
		const removed = deletePantryItem({ data: { id: item.id } })

		removed.then(
			() => router.invalidate(),
			() => {
				show(item.id, true)
				toast.error("couldn't remove that ingredient — try again")
			},
		)

		async function restore() {
			const back = {
				id: item.id,
				name: item.name,
				category: item.category,
				brand: item.brand,
				level: item.level,
				quantity: item.quantity,
				createdAt: item.createdAt,
				confirmedAt: item.confirmedAt,
				boughtAt: item.boughtAt,
				frozenAt: item.frozenAt,
			}

			try {
				await removed
				await restorePantryItem({
					data: item.spriteKey ? { ...back, spriteKey: item.spriteKey } : back,
				})
				await router.invalidate()
				show(item.id, true)
			} catch {
				toast.error(`couldn't bring back ${item.name} — try again`)
			}
		}

		undoToast(`removed ${item.name}`, () => void restore())
	}

	// Food whose days are up is not counted on anywhere, but it is not
	// dropped either: it waits at the top for the cook to say.
	const kept = items.filter((item) => !item.expired)
	const toCheck = items.filter((item) => item.expired)

	const selected = items.find((i) => i.id === selectedId) ?? null

	// Whether a line for the food waits on the grocery list, or is on its
	// way there.
	const waiting = list.filter((line) => !line.checkedAt)
	const [adding, setAdding] = useState<ReadonlySet<string>>(() => new Set())

	const lineOf = (item: PantryItem) =>
		waiting.find((line) => findInPantry(line.text, [item]))

	const isListed = (item: PantryItem) => adding.has(item.id) || !!lineOf(item)

	const client = useQueryClient()
	// While a line changes, its stepper waits, so a quick second tap
	// doesn't step from the same amount again.
	const [changing, startChange] = useTransition()

	// A line changed from a row: how much, or off the list.
	function changeLine(work: () => Promise<void>) {
		startChange(async () => {
			try {
				await work()
				await router.invalidate()
			} catch {
				toast.error("couldn't change your list — try again")
			}
		})
	}

	// Low or out food: onto the list, back to enough, or no longer kept.
	const actions: ShortActions = {
		lineOf,
		adding: (item) => adding.has(item.id),
		changing,
		step(line, by) {
			changeLine(async () => {
				await renameGrocery({
					data: {
						id: line.id,
						text: stepShopping(withAmountSaid(line.text), by).slice(0, 200),
					},
				})
			})
		},
		takeOff(line) {
			changeLine(async () => {
				await deleteGrocery({ data: { id: line.id } })
				void client.invalidateQueries({ queryKey: groceryCountKey })
			})
		},
		add(item) {
			setAdding((now) => new Set(now).add(item.id))

			void (async () => {
				try {
					await addGroceries({ data: [{ text: item.name }] })
					void client.invalidateQueries({ queryKey: groceryCountKey })
					toast(`added ${item.name} to your list`)
					await router.invalidate()
				} catch {
					toast.error(`couldn't add ${item.name} — try again`)
				}

				setAdding((now) => {
					const next = new Set(now)
					next.delete(item.id)

					return next
				})
			})()
		},
		haveEnough(item) {
			startChange(async () => {
				patch({ id: item.id, fields: { level: 'plenty' } })

				try {
					await setPantryItemLevel({ data: { id: item.id, level: 'plenty' } })
					await router.invalidate()
				} catch {
					toast.error(`couldn't change ${item.name} — try again`)
				}
			})
		},
		remove,
	}

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-4 p-6 pb-28 md:p-10">
				{/* The sidebar says where you are; the page opens on its own controls. */}
				<h1 className="sr-only">{view}</h1>
				{view === 'groceries' ? (
					<Need
						list={list}
						short={byShortness(
							kept.filter((item) => getsMore(item) && !isListed(item)),
						)}
						actions={actions}
					/>
				) : items.length === 0 ? (
					<>
						<PantryTitle />
						<section className="border-foreground/30 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
							<PantryPreview />
							<div className="flex flex-col gap-1">
								<p className="text-lg font-bold">nothing here yet</p>
								<p className="text-muted-foreground max-w-xs text-sm font-semibold">
									recipes and groceries check here for what you already have
								</p>
							</div>
							<Link
								to="/pantry/staples"
								className={buttonVariants({ size: 'lg' })}
							>
								<Plus size={14} weight="bold" aria-hidden />
								stock up
							</Link>
						</section>
					</>
				) : (
					<Timeline
						kept={kept}
						toCheck={toCheck}
						onRemove={remove}
						actions={actions}
					/>
				)}
			</div>

			{/* An item's details open by its row: right under it on a wide
			    screen, where the pointer already is; from the bottom on a phone. */}
			{selected ? (
				<ItemSheet
					anchor={() =>
						document.querySelector(`[data-pantry="${selected.id}"]`)
					}
					title={selected.name}
					// Focus starts on done, not on a level a stray key would change.
					initialFocus={() =>
						document.querySelector<HTMLElement>('[data-sheet-done]')
					}
					onClose={() =>
						void navigate({ to: here, search: {}, resetScroll: false })
					}
				>
					<DetailPanel
						key={selected.id}
						item={selected}
						line={lineOf(selected)}
						onPatch={(fields) => patch({ id: selected.id, fields })}
						onRemove={() => remove(selected)}
					/>
				</ItemSheet>
			) : null}
		</main>
	)
}

// How long food has left, in a cook's words, short enough for a pill.
function daysWord(days: number) {
	return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`
}

// What the kitchen needs: the grocery list itself, to tick, change and add
// to, and under it what the pantry says is low or out that isn't on it yet.
function Need({
	list,
	short,
	actions,
}: {
	list: GroceryItem[]
	short: PantryItem[]
	actions: ShortActions
}) {
	return (
		<GroceryList saved={list}>
			{short.length ? (
				<section
					aria-labelledby="running-low"
					className="mt-3 flex flex-col gap-1"
				>
					<h3
						id="running-low"
						className="text-muted-foreground flex min-h-8 items-center text-sm font-bold"
					>
						running low at home
					</h3>
					<ShortList items={short} actions={actions} />
				</section>
			) : null}
		</GroceryList>
	)
}

// Out first, then low, each by name.
const byShortness = (items: PantryItem[]) =>
	[...items].sort(
		(a, b) =>
			Number(b.level === 'out') - Number(a.level === 'out') ||
			a.name.localeCompare(b.name),
	)

// What can be done to food that's low or out, the same wherever it shows.
type ListLine = { id: string; text: string }

type ShortActions = {
	lineOf: (item: PantryItem) => ListLine | undefined
	adding: (item: PantryItem) => boolean
	changing: boolean
	add: (item: PantryItem) => void
	step: (line: ListLine, by: 1 | -1) => void
	takeOff: (line: ListLine) => void
	haveEnough: (item: PantryItem) => void
	remove: (item: PantryItem) => void
}

// Food that's low or out, as rows in one box as the list's aisles are: its
// picture, name and which, then one control: a plus to put it on the list,
// or how much once it's there. In the pantry the row opens the food's
// details, which hold the other answers; on the list a menu holds them.
function ShortList({
	items,
	actions,
	opens = false,
}: {
	items: PantryItem[]
	actions: ShortActions
	opens?: boolean
}) {
	return (
		<ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
			{items.map((item) => {
				const out = item.level === 'out'
				const line = actions.lineOf(item)

				const body = (
					<>
						<Sprite item={item} className="size-7" />
						<span className="min-w-0 truncate text-base">{item.name}</span>
						<span
							className={cn(
								'shrink-0 rounded-md px-1.5 text-xs leading-5 font-bold',
								out ? 'bg-kitchen-tomato/15' : 'bg-kitchen-yolk/25',
							)}
						>
							{out ? 'out' : 'low'}
						</span>
					</>
				)

				return (
					<li key={item.id} className="flex min-h-13 items-center gap-1 pr-2">
						{opens ? (
							<Link
								to="/pantry"
								search={{ item: item.id }}
								resetScroll={false}
								data-pantry={item.id}
								aria-label={`${item.name}, ${out ? 'out' : 'running low'}`}
								className="hover:bg-muted/40 flex min-h-13 min-w-0 flex-1 items-center gap-3 self-stretch pl-4 transition-colors"
							>
								{body}
							</Link>
						) : (
							<span className="flex min-w-0 flex-1 items-center gap-3 pl-4">
								{body}
							</span>
						)}
						{line ? (
							<CartStepper
								name={item.name}
								text={line.text}
								disabled={actions.changing}
								onStep={(by) => actions.step(line, by)}
								onTakeOff={() => actions.takeOff(line)}
							/>
						) : (
							<button
								type="button"
								aria-label={`add ${item.name} to your list`}
								disabled={actions.adding(item)}
								onClick={() => actions.add(item)}
								className="hover:bg-muted/60 border-input grid size-10 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-50"
							>
								<Plus size={16} weight="bold" aria-hidden />
							</button>
						)}
						{opens ? null : (
							<RecipeMenu
								label={`more for ${item.name}`}
								size="size-10"
								items={[
									{
										key: 'enough',
										label: 'i have enough',
										icon: CheckIcon,
										onSelect: () => actions.haveEnough(item),
									},
									{
										key: 'remove',
										label: 'don’t keep this',
										icon: TrashIcon,
										onSelect: () => actions.remove(item),
									},
								]}
							/>
						)}
					</li>
				)
			})}
		</ul>
	)
}

// An item's own picture.
function Sprite({ item, className }: { item: PantryItem; className?: string }) {
	return (
		<FoodPicture
			food={item.name}
			brand={item.brand}
			look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
			className={cn(
				'shrink-0 object-contain [image-rendering:pixelated]',
				className,
			)}
		/>
	)
}

// What the kitchen holds, as a timeline of how long it has: what to use now,
// this week and next, what it isn't sure is still there, what keeps, and
// what to get more of. Each line opens its details.
function Timeline({
	kept,
	toCheck,
	onRemove,
	actions,
}: {
	kept: PantryItem[]
	actions: ShortActions
	// Food bought for a meal whose days are up: probably eaten, maybe not.
	toCheck: PantryItem[]
	onRemove: (item: PantryItem) => void
}) {
	// Food to get more of sits in one place; what keeps a while, had or
	// not, sits on its shelf, off the timeline.
	const short = byShortness(kept.filter(getsMore))

	const left = kept
		.filter((item) => !keepsAWhile(item) && !getsMore(item))
		.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name))

	const now = left.filter((item) => item.daysLeft <= 1)

	const week = left.filter(
		(item) => item.daysLeft > 1 && item.daysLeft <= weekDays,
	)

	const next = left.filter(
		(item) => item.daysLeft > weekDays && item.daysLeft <= horizonDays,
	)

	return (
		<>
			<PantryTitle />
			{/* What's low or out, staple or fresh, as one line up top: the
			    grocery list offers the same food, so here it waits folded
			    and the fresh food stays first on screen. */}
			{short.length ? <RunningLow items={short} actions={actions} /> : null}
			{now.length ? (
				<Stretch label="use now">
					{now.map((item) => (
						<FoodRow key={item.id} item={item} days onRemove={onRemove} />
					))}
				</Stretch>
			) : null}
			{week.length ? (
				<Stretch label="this week">
					{week.map((item) => (
						<FoodRow key={item.id} item={item} days onRemove={onRemove} />
					))}
				</Stretch>
			) : null}
			{next.length ? (
				<Stretch label="next week">
					{next.map((item) => (
						<FoodRow key={item.id} item={item} days onRemove={onRemove} />
					))}
				</Stretch>
			) : null}
			{toCheck.length ? <NotSure items={toCheck} onRemove={onRemove} /> : null}
			{/* No fresh food yet: where it comes from, in its place. */}
			{!left.length && !toCheck.length ? (
				<div className="border-foreground/30 flex items-center gap-3 rounded-xl border border-dashed p-4">
					{/* Faded, as food not yet real is drawn. */}
					<PantrySprite
						look={standardLook({ key: categorySprites.vegetables })}
						className="size-10 shrink-0 opacity-40 grayscale [image-rendering:pixelated]"
					/>
					<div className="flex flex-col gap-0.5">
						<p className="text-base font-semibold">
							no fresh food expiring soon
						</p>
						<p className="text-muted-foreground text-sm">
							produce and perishables show up here when they’re within two weeks
							of expiring
						</p>
					</div>
				</div>
			) : null}
			{/* What keeps is looked up, not used up, and set up once: it sits
			    on the shelves, one line away, and food that came some other
			    way than the list is added there too. */}
			<StaplesLink />
		</>
	)
}

// The page's name, as the grocery list and recipes have, the same gap
// above what follows as theirs: the page's rows sit a little further apart.
function PantryTitle() {
	return (
		<p className="-mb-1 flex min-h-10 items-center gap-2 text-lg font-bold">
			<JarLabelIcon size={20} weight="bold" aria-hidden />
			pantry
		</p>
	)
}

// Food that's low or out, folded to one line: a few pictures, how many,
// and how many are on the list. Opened, it's the rows themselves.
function RunningLow({
	items,
	actions,
}: {
	items: PantryItem[]
	actions: ShortActions
}) {
	const [open, setOpen] = useState(false)
	const listed = items.filter((item) => actions.lineOf(item)).length

	return (
		<section aria-label="running low" className="flex flex-col gap-1">
			<button
				type="button"
				aria-expanded={open}
				aria-controls="running-low-rows"
				onClick={() => setOpen((now) => !now)}
				className={cn(
					'bg-card border-border hover:bg-muted/40 flex min-h-14 items-center gap-3 border px-4 text-left transition-colors',
					open ? 'rounded-t-xl' : 'rounded-xl',
				)}
			>
				<span aria-hidden className="flex -space-x-1.5">
					{items.slice(0, 3).map((item) => (
						<Sprite key={item.id} item={item} className="size-6" />
					))}
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="text-base font-bold">
						{items.length} running low
					</span>
					{listed ? (
						<span className="text-muted-foreground text-xs font-semibold">
							{listed === items.length ? 'all' : listed} on your list
						</span>
					) : null}
				</span>
				<CaretDownIcon
					size={14}
					weight="bold"
					aria-hidden
					className={cn(
						'text-muted-foreground transition-transform',
						open && 'rotate-180',
					)}
				/>
			</button>
			{open ? (
				<div
					id="running-low-rows"
					className="-mt-1 [&>ul]:rounded-t-none [&>ul]:border-t-0"
				>
					<ShortList items={items} actions={actions} opens />
				</div>
			) : null}
		</section>
	)
}

// The way to everything kept, as a quiet link at the foot of the page,
// as a shelf's "more" is.
function StaplesLink() {
	return (
		<Link
			to="/pantry/staples"
			className="text-muted-foreground hover:text-foreground flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold transition-colors"
		>
			see all your food
			<CaretRightIcon size={12} weight="bold" aria-hidden />
		</Link>
	)
}

// One stretch of the timeline: its name, then its food in one box of rows,
// as the grocery list's aisles are.
function Stretch({
	label,
	heading: Heading = 'h2',
	children,
}: {
	label: string
	heading?: 'h2' | 'h3'
	children: React.ReactNode
}) {
	return (
		<section aria-label={label} className="flex flex-col gap-1">
			<Heading
				className={cn(
					'flex min-h-8 items-center text-sm font-bold',
					Heading === 'h2' ? 'text-muted-foreground' : 'text-foreground',
				)}
			>
				{label}
			</Heading>
			<ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
				{children}
			</ul>
		</section>
	)
}

// How long food has left, at the end of its row: plain words, with a
// tomato tint only once it's down to today or tomorrow.
function DaysLeft({ days }: { days: number }) {
	return days <= 1 ? (
		<span
			aria-hidden
			className="bg-kitchen-tomato/15 shrink-0 rounded-md px-1.5 text-xs leading-5 font-bold"
		>
			{daysWord(days)}
		</span>
	) : (
		<span
			aria-hidden
			className="text-muted-foreground shrink-0 text-xs font-semibold tabular-nums"
		>
			{daysWord(days)}
		</span>
	)
}

// How far a row slides left before letting go takes it away.
const swipeAway = 96

// One food on the timeline: how long it has when that's worth saying, its
// picture and name, and how much is left when the cook keeps track. It
// opens its details; swiped left, it's gone, as the grocery list's rows
// go, and the toast brings it back.
function FoodRow({
	item,
	days = false,
	onRemove,
}: {
	item: PantryItem
	days?: boolean
	onRemove: (item: PantryItem) => void
}) {
	const [swiping, setSwiping] = useState(false)
	// A swipe ends on the row it started on, which would open it too.
	const swiped = useRef(false)

	const note =
		item.quantity !== null && !getsMore(item)
			? `${item.quantity} left`
			: undefined

	return (
		<li className="relative overflow-hidden">
			{/* What letting go does, under the row as it slides. */}
			{swiping ? (
				<span
					aria-hidden
					className="bg-kitchen-tomato absolute inset-0 flex items-center justify-end gap-2 pr-5 text-sm font-bold"
				>
					<TrashIcon size={18} weight="bold" />
					gone
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

					if (info.offset.x < -swipeAway || info.velocity.x < -800)
						onRemove(item)
				}}
				onClickCapture={(event) => {
					if (!swiped.current) return

					swiped.current = false
					event.preventDefault()
					event.stopPropagation()
				}}
				// Up and down still scrolls the page.
				className="bg-card relative touch-pan-y"
			>
				<Link
					to="/pantry"
					search={{ item: item.id }}
					resetScroll={false}
					data-pantry={item.id}
					draggable={false}
					aria-label={`${item.name}${item.brand ? `, ${item.brand}` : ''}, ${leftOf(item)}${days ? `, ${daysWord(item.daysLeft)}` : ''}`}
					className="hover:bg-muted/40 flex min-h-13 items-center gap-3 px-4 transition-colors"
				>
					<Sprite item={item} className="size-7" />
					<span className="min-w-0 flex-1 truncate py-2 text-base">
						<WithBrand name={item.name} brand={item.brand} />
					</span>
					{item.frozenAt ? (
						<SnowflakeIcon
							size={16}
							weight="bold"
							aria-hidden
							className="text-muted-foreground shrink-0"
						/>
					) : null}
					{note ? (
						<span className="text-muted-foreground shrink-0 text-xs font-semibold">
							{note}
						</span>
					) : null}
					{days ? <DaysLeft days={item.daysLeft} /> : null}
				</Link>
			</motion.div>
		</li>
	)
}

// Food bought for a meal whose days are up: probably eaten, maybe not. It
// is not counted on anywhere until the cook says it is still there.
function NotSure({
	items,
	onRemove,
}: {
	items: PantryItem[]
	onRemove: (item: PantryItem) => void
}) {
	const router = useRouter()
	const [pending, setPending] = useState<string>()

	async function keep(item: PantryItem) {
		setPending(item.id)

		try {
			await keepPantryItem({ data: { id: item.id } })
			await router.invalidate()
		} catch {
			toast.error("couldn't keep that ingredient — try again")
		} finally {
			setPending(undefined)
		}
	}

	return (
		<Stretch label="still have these?">
			{items.map((item) => (
				<li
					key={item.id}
					className="flex min-h-13 items-center gap-3 px-4 py-1.5"
				>
					<Sprite item={item} className="size-7 opacity-60" />
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-base">{item.name}</span>
						<span className="text-muted-foreground text-xs font-semibold">
							{boughtAgo(item.boughtDaysAgo)}
						</span>
					</span>
					<button
						type="button"
						disabled={pending === item.id}
						onClick={() => void keep(item)}
						className={buttonVariants({
							variant: 'outline',
							size: 'sm',
						})}
					>
						still have it
					</button>
					<button
						type="button"
						onClick={() => onRemove(item)}
						className={buttonVariants({
							variant: 'ghost',
							size: 'sm',
						})}
					>
						gone
					</button>
				</li>
			))}
		</Stretch>
	)
}

// How long ago food came in, in days.
function boughtAgo(days: number) {
	return days === 0
		? 'bought today'
		: days === 1
			? 'bought yesterday'
			: `bought ${days} days ago`
}

// How long food has left, as a cook would say it.
function keepsFor(days: number) {
	if (days <= 0) return 'use today'

	if (days === 1) return '1 day left'

	if (days < 14) return `${days} days left`

	if (days <= 60) return `~${Math.round(days / 7)} wks`

	if (days <= 365) return `~${Math.max(1, Math.round(days / 30))} mo`

	return 'keeps'
}

// Two states, not three: a food is had, or wanted. Low and out, kept apart
// in the pantry's records, both mean get more, and a recipe still counts
// low food as home.
const getsMore = (item: { level: PantryLevel }) => item.level !== 'plenty'

// How much is left, in words: a count when the cook keeps one, else whether
// to get more.
function leftOf(item: PantryItem) {
	if (getsMore(item)) return 'get more'

	return item.quantity === null ? 'enough' : `${item.quantity} left`
}

export function DetailPanel({
	item,
	line,
	onPatch,
	onRemove,
}: {
	item: PantryItem
	// Its line waiting on the grocery list, if there is one.
	line: { id: string; text: string } | undefined
	// Shows a change on the page before the server has it.
	onPatch: (fields: Partial<PantryItem>) => void
	onRemove: () => void
}) {
	const router = useRouter()
	const client = useQueryClient()
	const [pending, startSave] = useTransition()

	// Low or out is only said; the list takes it when the cook asks.
	function addToList(text: string) {
		save(async () => {
			await addGroceries({ data: [{ text: text.slice(0, 200) }] })
			void client.invalidateQueries({ queryKey: groceryCountKey })
			toast(`added ${item.name} to your list`)
		})
	}

	// Sends a change, then reads the kitchen again. Given what it changes, the
	// page shows it at once; a failure shows the kitchen as the server has it.
	function save(send: () => Promise<void>, fields?: Partial<PantryItem>) {
		startSave(async () => {
			if (fields) onPatch(fields)

			try {
				await send()
			} catch {
				toast.error("couldn't update how much is left — try again")
			}

			// Waits for the fresh read itself (sync), so the change shown stays
			// until it lands. The change is made; a failed read leaves the page.
			await router.invalidate({ sync: true }).catch(() => undefined)
			// Pages that read the list apart from their loader read it again.
			void client.invalidateQueries({ queryKey: groceryLinesKey })
		})
	}

	const food = foodOf(item.name)
	// Food kept one by one can also say how many, under its level.
	const counted = food?.kind === 'count'
	const packs = counted ? food.packs : []

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<FoodPicture
					food={item.name}
					brand={item.brand}
					look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
					className="size-7 shrink-0 object-contain [image-rendering:pixelated]"
				/>
				<p className="min-w-0 flex-1 truncate text-lg font-bold">{item.name}</p>
			</div>
			<BrandField
				food={item.name}
				brand={item.brand}
				onBrand={(brand) =>
					save(
						async () => {
							await setPantryItemBrand({
								data: { id: item.id, brand: brand ?? '' },
							})
						},
						{ brand },
					)
				}
			/>
			<PantryNeed
				name={item.name}
				level={item.level}
				line={line}
				disabled={pending}
				onLevel={(level) =>
					save(
						async () => {
							await setPantryItemLevel({ data: { id: item.id, level } })
						},
						{ level },
					)
				}
				onAdd={addToList}
				onStep={(listed, by) =>
					save(async () => {
						await renameGrocery({
							data: {
								id: listed.id,
								text: stepShopping(withAmountSaid(listed.text), by).slice(
									0,
									200,
								),
							},
						})
					})
				}
				onTakeOff={(listed) =>
					save(async () => {
						await deleteGrocery({ data: { id: listed.id } })
						void client.invalidateQueries({ queryKey: groceryCountKey })
					})
				}
			/>
			{counted && !getsMore(item) ? (
				<Counter
					key={item.quantity ?? 'none'}
					count={item.quantity}
					onCount={(count) =>
						save(
							async () => {
								await setPantryItemCount({
									data: { id: item.id, count },
								})
							},
							{ quantity: count },
						)
					}
				/>
			) : null}
			{/* Bought more: a pack's worth onto the count, or just plenty. */}
			<div className="flex flex-wrap gap-2">
				{(packs.length ? packs : [undefined]).map((pack) => (
					<button
						key={pack ?? 'more'}
						type="button"
						disabled={pending}
						onClick={() =>
							save(async () => {
								await restockPantryItem({
									data: pack ? { id: item.id, added: pack } : { id: item.id },
								})
							})
						}
						className={buttonVariants({
							variant: 'outline',
							size: 'lg',
						})}
					>
						<Plus size={16} weight="bold" aria-hidden />
						{pack ? `bought ${pack}` : 'bought more'}
					</button>
				))}
				{/* Into the freezer, to keep for months; food bought frozen lives
				    there already. */}
				{item.frozenAt || item.category !== 'frozen' ? (
					<button
						type="button"
						disabled={pending}
						onClick={() => {
							const frozen = !item.frozenAt

							save(async () => {
								await setPantryItemFrozen({ data: { id: item.id, frozen } })
								toast(
									frozen
										? `${item.name} is in the freezer`
										: `${item.name} is out of the freezer`,
								)
							})
						}}
						className={buttonVariants({
							variant: 'outline',
							size: 'lg',
						})}
					>
						<SnowflakeIcon size={16} weight="bold" aria-hidden />
						{item.frozenAt ? 'take out' : 'freeze it'}
					</button>
				) : null}
			</div>
			<dl className="text-muted-foreground border-foreground/20 w-full border-t pt-3 text-xs">
				<div className="flex justify-between py-0.5">
					<dt>category</dt>
					<dd className="text-foreground font-semibold">
						{pantryCategoryLabels[item.category]}
					</dd>
				</div>
				<div className="flex justify-between py-0.5">
					<dt>bought</dt>
					<dd className="text-foreground font-semibold">
						{item.boughtDaysAgo < 7
							? boughtAgo(item.boughtDaysAgo).replace(/^bought /, '')
							: dateFormat.format(item.boughtAt).toLowerCase()}
					</dd>
				</div>
				{item.frozenAt ? (
					<div className="flex justify-between py-0.5">
						<dt>frozen</dt>
						<dd className="text-foreground font-semibold">
							{dateFormat.format(item.frozenAt).toLowerCase()}
						</dd>
					</div>
				) : null}
				{item.level === 'out' || item.daysLeft > 365 ? null : (
					<div className="flex justify-between py-0.5">
						<dt>keeps</dt>
						<dd className="text-foreground font-semibold">
							{keepsFor(item.daysLeft)}
						</dd>
					</div>
				)}
			</dl>
			<div className="flex w-full items-center justify-between gap-2">
				<button
					type="button"
					onClick={onRemove}
					className={buttonVariants({ variant: 'destructive' })}
				>
					<TrashIcon size={16} weight="bold" aria-hidden />
					delete
				</button>
				<ItemSheetDone data-sheet-done className={buttonVariants()}>
					done
				</ItemSheetDone>
			</div>
		</div>
	)
}

// A count for food kept one by one, if the cook keeps one. Taps show at once
// and only the count they settle on is saved, so quick taps all land.
function Counter({
	count,
	onCount,
}: {
	count: number | null
	onCount: (count: number) => void
}) {
	const [shown, setShown] = useState(count)
	const now = shown ?? 0
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	const waiting = useRef<number>(undefined)
	const send = useRef(onCount)

	useEffect(() => {
		send.current = onCount
	})

	// A count still waiting when the sheet closes is saved, not lost.
	useEffect(
		() => () => {
			clearTimeout(timer.current)

			if (waiting.current !== undefined) send.current(waiting.current)
		},
		[],
	)

	function set(next: number) {
		const bounded = Math.min(pantryQuantityMax, Math.max(0, next))

		setShown(bounded)
		waiting.current = bounded
		clearTimeout(timer.current)
		timer.current = setTimeout(() => {
			waiting.current = undefined
			send.current(bounded)
		}, 500)
	}

	const stepClassName =
		'border-border bg-background hover:bg-kitchen-yolk/40 flex size-11 items-center justify-center rounded-md border disabled:opacity-40'

	return (
		<div className="flex flex-col items-center gap-2">
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label="one fewer"
					disabled={now <= 0}
					onClick={() => set(now - 1)}
					className={stepClassName}
				>
					<Minus size={16} weight="bold" aria-hidden />
				</button>
				<output
					aria-label="count"
					className="min-w-16 text-center font-mono text-2xl font-bold"
				>
					{shown === null ? '' : `× ${shown}`}
				</output>
				<button
					type="button"
					aria-label="one more"
					disabled={now >= pantryQuantityMax}
					onClick={() => set(now + 1)}
					className={stepClassName}
				>
					<Plus size={16} weight="bold" aria-hidden />
				</button>
			</div>
			{shown === null ? (
				<p className="text-muted-foreground text-xs font-semibold">
					count them, if you like
				</p>
			) : null}
		</div>
	)
}
