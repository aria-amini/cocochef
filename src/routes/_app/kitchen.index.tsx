import { Menu } from '@base-ui/react/menu'
import {
	CheckIcon,
	CaretDownIcon,
	ClockIcon,
	JarLabelIcon,
	Minus,
	Plus,
	ShoppingCartIcon,
	SnowflakeIcon,
	TrashIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { GroceryList, type GroceryItem } from '@/components/grocery-list'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { SpotIcon } from '@/components/spot-icon'
import { buttonVariants } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { addGroceries, listGroceries } from '@/lib/groceries/server'
import { rememberKitchenView } from '@/lib/kitchen-view'
import { categorySprites } from '@/lib/pantry/catalog'
import { findInPantry, foodOf } from '@/lib/pantry/foods'
import {
	pantryCategoryLabels,
	pantryLevelLabels,
	pantryLevels,
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
	setPantryItemCount,
	setPantryItemFrozen,
	setPantryItemLevel,
} from '@/lib/pantry/server'
import {
	pantrySpotLabels,
	pantrySpots,
	shelvesOf,
	spotOf,
	type PantrySpot,
} from '@/lib/pantry/spots'
import { resolveSpriteLook } from '@/lib/pantry/sprites'
import { standardLook } from '@/lib/pantry/tinted-sprites'
import { cn } from '@/lib/utils/ui'

// The page's place: one spot's jars, the item whose details are open, and
// which side is open: on hand, or the grocery list. Old links that asked for
// shopping open the list.
const pantrySearch = z.object({
	spot: z.enum(pantrySpots).optional().catch(undefined),
	item: z.string().optional(),
	shop: z.boolean().optional().catch(undefined),
	// On hand shows what to use first, or what came in last.
	list: z.enum(['recent']).optional().catch(undefined),
	// Which side is open: on hand, or the grocery list.
	view: z.enum(['groceries']).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/kitchen/')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: pantrySearch,
	beforeLoad: ({ search }) => {
		if (search.shop)
			throw redirect({ to: '/kitchen', search: { view: 'groceries' } })
	},
	// What is in the kitchen, and the list of what it needs.
	loader: async () => {
		const [pantry, groceries] = await Promise.all([
			listPantry(),
			listGroceries(),
		])

		return pantry && groceries ? { pantry, groceries } : null
	},
	component: PantryPage,
})

type PantryItem = NonNullable<Awaited<ReturnType<typeof listPantry>>>[number]

// A pantry is kept by an account; signed out, the page says so.
function PantryPage() {
	const loaded = Route.useLoaderData()

	if (loaded) return <Pantry loaded={loaded.pantry} list={loaded.groceries} />

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 md:p-10">
				<h1 className="sr-only">kitchen</h1>
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

// The kitchen opens on this much of its food, soonest to go first.
const firstShown = 9

function Pantry({
	loaded,
	list,
}: {
	loaded: PantryItem[]
	list: GroceryItem[]
}) {
	const navigate = useNavigate()
	const router = useRouter()

	const { spot, item: selectedId, view, list: showing } = Route.useSearch()

	// The tab reopens whichever side was open last.
	useEffect(() => {
		rememberKitchenView(view)
	}, [view])

	// A removed item leaves the list at once, and the pantry only once its
	// undo has passed.
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
	const items = loaded.filter((item) => !hidden.has(item.id))

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
		void navigate({ to: '/kitchen', search: { spot }, resetScroll: false })

		const removed = deletePantryItem({ data: { id: item.id } }).then(() =>
			router.invalidate(),
		)

		removed.catch(() => {
			show(item.id, true)
			toast.error("couldn't remove that ingredient — try again")
		})

		async function restore() {
			const back = {
				id: item.id,
				name: item.name,
				category: item.category,
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

	// The page leads with only what asks for something: food going off, and
	// food that ran out or runs low. The rest is on hand, by where it lives.
	// Food that goes off within two weeks, soonest first: what to use first.
	const fresh = kept
		.filter((item) => item.level !== 'out' && item.daysLeft <= horizonDays)
		.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name))

	// What came into the kitchen last: added, bought or restocked.
	const recent = [...kept].sort(
		(a, b) => b.boughtAt.getTime() - a.boughtAt.getTime(),
	)

	const wanting = byName(kept.filter((item) => item.level !== 'plenty')).sort(
		(a, b) => Number(b.level === 'out') - Number(a.level === 'out'),
	)

	const inSpot = spot
		? byName(kept.filter((item) => spotOf(item) === spot))
		: []

	const selected = items.find((i) => i.id === selectedId) ?? null

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-4 p-6 pb-28 md:p-10">
				{/* The sidebar says where you are; the page opens on its own controls. */}
				<h1 className="sr-only">kitchen</h1>
				<KitchenSwitch
					view={view}
					buy={list.filter((line) => !line.checkedAt).length}
				/>
				{view === 'groceries' ? (
					<Need list={list} wanting={wanting} />
				) : items.length === 0 ? (
					<>
						<section className="border-foreground/30 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
							<PantryPreview />
							<div className="flex flex-col gap-1">
								<p className="text-lg font-bold">nothing here yet</p>
								<p className="text-muted-foreground max-w-xs text-sm font-semibold">
									recipes and groceries check here for what you already have
								</p>
							</div>
							<Link
								to="/kitchen/bulk"
								className={buttonVariants({ className: 'min-h-11 gap-1.5' })}
							>
								<Plus size={14} weight="bold" aria-hidden />
								stock up
							</Link>
						</section>
					</>
				) : (
					<>
						{toCheck.length ? (
							<CheckThese items={toCheck} onRemove={remove} />
						) : null}
						<OnHand
							items={kept}
							fresh={fresh}
							recent={recent}
							showing={showing}
							spot={spot}
							inSpot={inSpot}
							selectedId={selectedId}
						/>
					</>
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
						void navigate({
							to: '/kitchen',
							search: { spot },
							resetScroll: false,
						})
					}
				>
					<DetailPanel
						key={selected.id}
						item={selected}
						onRemove={() => remove(selected)}
					/>
				</ItemSheet>
			) : null}
		</main>
	)
}

// The kitchen's two sides, side by side at its top: what it has, and the
// grocery list of what it needs, each with its count. Each keeps its place,
// so neither moves when the other grows.
function KitchenSwitch({
	view,
	buy,
}: {
	view: 'groceries' | undefined
	buy: number
}) {
	const sides = [
		{
			key: 'have',
			label: 'on hand',
			mark: JarLabelIcon,
			count: 0,
			picked: !view,
		},
		{
			key: 'buy',
			label: 'groceries',
			mark: ShoppingCartIcon,
			count: buy,
			picked: view === 'groceries',
		},
	] as const

	return (
		<nav
			aria-label="kitchen"
			className="border-input grid grid-cols-2 overflow-hidden rounded-md border"
		>
			{sides.map(({ key, label, mark: Mark, count, picked }) => (
				<Link
					key={key}
					to="/kitchen"
					search={key === 'buy' ? { view: 'groceries' } : {}}
					aria-current={picked ? 'page' : undefined}
					className={cn(
						'border-input flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-bold transition-colors not-first:border-l',
						picked ? 'bg-kitchen-yolk/30' : 'hover:bg-muted/60',
					)}
				>
					<Mark size={18} weight={picked ? 'fill' : 'bold'} aria-hidden />
					{label}
					{/* How much is left to buy, in a small yolk pill after its name. */}
					{count ? (
						<span className="bg-kitchen-yolk grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs leading-none font-bold tabular-nums">
							<span className="sr-only">, </span>
							{count}
						</span>
					) : null}
				</Link>
			))}
		</nav>
	)
}

// How long food has left, in a cook's words, short enough for a pill.
function daysWord(days: number) {
	return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`
}

// How long food has left, as a badge across from its picture: solid tomato
// for today and tomorrow, solid yolk for the rest of the week, paper after.
function DaysBadge({ days }: { days: number }) {
	return (
		<span
			aria-hidden
			className={cn(
				'rounded-full px-1.5 text-xs leading-4 font-bold whitespace-nowrap tabular-nums',
				days <= 1
					? 'bg-kitchen-tomato'
					: days <= weekDays
						? 'bg-kitchen-yolk'
						: 'bg-card outline-foreground/25 outline',
			)}
		>
			{daysTag(days)}
		</span>
	)
}

// Days left, short enough to sit by a picture on the narrowest card:
// "now", "2d", "13d".
function daysTag(days: number) {
	return days <= 0 ? 'now' : `${days}d`
}

// Food as cards to pick up, on the grid every view of the kitchen shares:
// what to use first, or what came in last.
function FoodCards({ label, items }: { label: string; items: PantryItem[] }) {
	const [all, setAll] = useState(false)
	const shown = all ? items : items.slice(0, firstShown)

	return (
		<div className="flex flex-col gap-3">
			<ul aria-label={label} className={foodGridClassName}>
				{shown.map((item) => (
					<li key={item.id}>
						<FoodCard item={item} search={{ item: item.id }} />
					</li>
				))}
			</ul>
			{items.length > firstShown ? (
				<button
					type="button"
					aria-expanded={all}
					onClick={() => setAll((now) => !now)}
					className="text-muted-foreground hover:text-foreground -ml-2 min-h-10 self-start rounded-md px-2 text-sm font-bold transition-colors"
				>
					{all ? 'show fewer' : `show all ${items.length}`}
				</button>
			) : null}
		</div>
	)
}

// The one grid food sits on, in every view of the kitchen, so cards line up
// whichever is showing.
const foodGridClassName = 'grid grid-cols-3 gap-2 md:grid-cols-5'

// One food: its picture, its name, and across from the picture how long it
// has. One that ran out is dashed and struck; one running low is tinted
// yolk. It opens its details.
function FoodCard({
	item,
	search,
	selected = false,
}: {
	item: PantryItem
	search: { spot?: PantrySpot; item: string }
	selected?: boolean
}) {
	const out = item.level === 'out'

	return (
		<Link
			to="/kitchen"
			search={search}
			resetScroll={false}
			data-pantry={item.id}
			aria-label={`${item.name}, ${leftOf(item)}${out ? '' : `, ${daysWord(item.daysLeft)}`}`}
			aria-current={selected ? 'true' : undefined}
			className={cn(
				// One height for every card, two lines of name, so rows match
				// whatever the names.
				'hover:border-foreground/25 relative flex h-24 flex-col gap-1.5 rounded-xl border p-2.5 transition-colors',
				// A tile's tan against the paper is its only edge; out food,
				// not there, is dashed instead.
				out
					? 'border-foreground/35 border-dashed'
					: item.level === 'low'
						? 'bg-kitchen-yolk/30 border-transparent'
						: 'bg-background border-transparent',
				selected && 'border-foreground/45 border-solid',
			)}
		>
			{/* The picture and, across from it, how long it has: one row, so
			    the two never meet however narrow the card. */}
			<span className="flex items-start justify-between gap-1">
				<Sprite
					item={item}
					className={cn('size-8 shrink-0', out && 'opacity-40 grayscale')}
				/>
				{/* Only what goes off within two weeks says when; nobody needs
				    to know the vinegar keeps a year. */}
				{out || item.daysLeft > horizonDays ? null : (
					<DaysBadge days={item.daysLeft} />
				)}
			</span>
			<span
				className={cn(
					// At the card's foot, so its space falls between picture and name.
					'mt-auto line-clamp-2 text-sm leading-tight font-bold',
					out && 'text-muted-foreground line-through',
				)}
			>
				{item.name}
			</span>
		</Link>
	)
}

// What the kitchen needs: the grocery list itself, to tick, change and add
// to, each line saying why when the kitchen knows (out, low, or the recipe it
// is for); and below it what ran out or runs low but is not on it yet.
function Need({
	list,
	wanting,
}: {
	list: GroceryItem[]
	wanting: PantryItem[]
}) {
	const waiting = list.filter((line) => !line.checkedAt)

	const unlisted = wanting.filter(
		(item) => !waiting.some((line) => findInPantry(line.text, [item])),
	)

	return (
		<GroceryList
			saved={list}
			noteOf={(line) => (
				<NeedNote line={line} kept={findInPantry(line.text, wanting)} />
			)}
		>
			{unlisted.length ? (
				<div className="flex flex-wrap items-center gap-2">
					{unlisted.map((item) => (
						<Link
							key={item.id}
							to="/kitchen"
							search={{ item: item.id }}
							resetScroll={false}
							data-pantry={item.id}
							aria-label={`${item.name}, ${leftOf(item)}`}
							className="border-foreground/30 hover:border-foreground/50 inline-flex min-h-10 items-center gap-2 rounded-full border border-dashed px-3 text-sm font-semibold transition-colors"
						>
							<Sprite item={item} className="size-5" />
							{item.name}
							{item.level === 'out' ? (
								<span className="text-muted-foreground">out</span>
							) : (
								<LevelIcon level={item.level} />
							)}
						</Link>
					))}
					<BuyButton names={unlisted.map((item) => item.name)} />
				</div>
			) : null}
		</GroceryList>
	)
}

// Why a line is wanted, when the kitchen knows: the food ran out or runs
// low, or a recipe asked for it.
function NeedNote({
	line,
	kept,
}: {
	line: GroceryItem
	kept: PantryItem | undefined
}) {
	if (kept?.level === 'out')
		return (
			<span className="bg-kitchen-tomato/15 shrink-0 rounded-full px-2 text-xs leading-5 font-bold">
				out
			</span>
		)

	if (kept?.level === 'low')
		return (
			<span className="bg-kitchen-yolk/30 shrink-0 rounded-full px-2 text-xs leading-5 font-bold">
				low
			</span>
		)

	if (line.recipeTitle)
		return (
			<span className="text-muted-foreground max-w-[45%] min-w-0 shrink truncate text-xs font-semibold">
				for {line.recipeTitle}
			</span>
		)

	return null
}

// What the kitchen holds, on one surface: one picker and the food it picks.
// The picker offers what to use first (the default), what came in last, and
// each spot; whichever it is, the food shows on the same grid. Stocking up
// sits across from it.
function OnHand({
	items,
	fresh,
	recent,
	showing,
	spot,
	inSpot,
	selectedId,
}: {
	items: PantryItem[]
	// Food that goes off within two weeks, soonest first.
	fresh: PantryItem[]
	// What came in last, newest first.
	recent: PantryItem[]
	showing: 'recent' | undefined
	// The spot picked, if one is, and what it holds.
	spot: PantrySpot | undefined
	inSpot: PantryItem[]
	selectedId: string | undefined
}) {
	const view: KitchenPick = spot ?? (showing === 'recent' ? 'recent' : 'first')

	return (
		<section
			aria-labelledby="on-hand"
			className="bg-card border-border flex flex-col gap-3 rounded-xl border p-4"
		>
			<h2 id="on-hand" className="sr-only">
				on hand
			</h2>
			<div className="-my-1 flex min-h-10 items-center gap-1">
				<div className="flex flex-1 items-center">
					<ViewMenu view={view} items={items} fresh={fresh.length} />
				</div>
				<Link
					to="/kitchen/bulk"
					aria-label="stock up"
					title="stock up"
					// Its tap room hangs into the gutter, so the mark lines up with
					// the cards' right edge.
					className={cn(iconButtonClassName, '-mr-2.5')}
				>
					<Plus size={18} weight="bold" aria-hidden />
				</Link>
			</div>
			{spot ? (
				<JarWall items={inSpot} spot={spot} selectedId={selectedId} />
			) : showing === 'recent' ? (
				recent.length ? (
					<FoodCards label="recently added" items={recent} />
				) : (
					<EmptyBlock
						mark={<ClockIcon size={20} weight="bold" aria-hidden />}
						title="nothing added yet"
						body="what you bring home shows here first"
					/>
				)
			) : fresh.length ? (
				<FoodCards label="use first" items={fresh} />
			) : (
				<EmptyBlock
					mark={<WarningCircleIcon size={20} weight="bold" aria-hidden />}
					title="nothing to use first"
					body="everything here keeps for two weeks or more"
				/>
			)}
		</section>
	)
}

// What the picker can show: food to use first, food that came in last, or
// one spot's food.
type KitchenPick = 'first' | 'recent' | PantrySpot

const pickLabels: Record<'first' | 'recent', string> = {
	first: 'use first',
	recent: 'recent',
}

const pickLabel = (pick: KitchenPick) =>
	pick === 'first' || pick === 'recent'
		? pickLabels[pick]
		: pantrySpotLabels[pick]

// A pick's mark: an exclamation for what to use first, a clock for what came
// in last, and each spot's own.
function PickMark({ pick, size = 18 }: { pick: KitchenPick; size?: number }) {
	if (pick === 'first')
		return <WarningCircleIcon size={size} weight="bold" aria-hidden />

	if (pick === 'recent')
		return <ClockIcon size={size} weight="bold" aria-hidden />

	return <SpotIcon spot={pick} size={size} />
}

// The surface's one picker: its name says what is showing, and it opens on
// every view, the two lists first and then the spots, each with what it
// holds when that is worth saying.
function ViewMenu({
	view,
	items,
	fresh,
}: {
	view: KitchenPick
	items: PantryItem[]
	fresh: number
}) {
	const navigate = useNavigate()

	const picks: {
		pick: KitchenPick
		search: { spot?: PantrySpot; list?: 'recent' }
	}[] = [
		{ pick: 'first', search: {} },
		{ pick: 'recent', search: { list: 'recent' } },
		...pantrySpots.map((each) => ({ pick: each, search: { spot: each } })),
	]

	return (
		<Menu.Root>
			<Menu.Trigger className="hover:bg-muted/60 data-popup-open:bg-muted -ml-2 inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-bold transition-colors">
				<PickMark pick={view} />
				{pickLabel(view)}
				{view === 'first' && fresh ? (
					<span className="text-muted-foreground tabular-nums">{fresh}</span>
				) : null}
				<CaretDownIcon size={12} weight="bold" aria-hidden />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					className="z-50"
					side="bottom"
					align="start"
					sideOffset={6}
				>
					<Menu.Popup className="floating bg-background w-56 py-1 outline-none">
						{picks.map(({ pick, search }, index) => {
							const empty =
								pick !== 'first' &&
								pick !== 'recent' &&
								!items.some((item) => spotOf(item) === pick)

							return (
								<Menu.Item
									key={pick}
									onClick={() =>
										void navigate({
											to: '/kitchen',
											search,
											resetScroll: false,
										})
									}
									className={cn(
										'data-highlighted:bg-kitchen-yolk/40 flex w-full cursor-default items-center gap-3 px-3 py-2.5 text-sm font-semibold outline-none select-none',
										// The spots start after a hairline, apart from the lists.
										index === 2 && 'border-border mt-1 border-t pt-3.5',
									)}
								>
									<span className={cn(empty && 'text-muted-foreground')}>
										<PickMark pick={pick} />
									</span>
									<span className="flex-1">{pickLabel(pick)}</span>
									{pick === view ? (
										<CheckIcon size={14} weight="bold" aria-hidden />
									) : null}
								</Menu.Item>
							)
						})}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	)
}

// Nothing to show: a dashed block as tall as a row of cards, in their place,
// saying so and why, with what to do about it when there is something.
function EmptyBlock({
	mark,
	title,
	body,
	action,
}: {
	// Drawn in the block's quiet ink, 20px.
	mark: React.ReactNode
	title: string
	body: string
	action?: React.ReactNode
}) {
	return (
		<div className="border-foreground/30 flex min-h-24 items-center gap-3 rounded-xl border border-dashed p-3">
			<span className="text-muted-foreground shrink-0">{mark}</span>
			<div className="flex min-w-0 flex-1 flex-col">
				<p className="text-sm font-bold">{title}</p>
				<p className="text-muted-foreground text-sm font-semibold">{body}</p>
			</div>
			{action}
		</div>
	)
}

// A quiet square button in the surface's corner, for one action by its mark.
const iconButtonClassName =
	'text-muted-foreground hover:text-foreground hover:bg-muted/60 grid size-10 shrink-0 place-items-center rounded-md transition-colors'

// A spot names its shelves only once it holds this much; below it, one grid
// in shelf order reads better than rows of one or two.
const shelvesFrom = 9

// One spot's food on the same grid as every list of food. A full spot is
// split into named shelves; a small one is one grid in shelf order.
function JarWall({
	items,
	spot,
	selectedId,
}: {
	items: PantryItem[]
	spot: PantrySpot
	selectedId: string | undefined
}) {
	if (!items.length)
		return (
			<EmptyBlock
				mark={<SpotIcon spot={spot} size={20} />}
				title={`nothing in the ${pantrySpotLabels[spot]} yet`}
				body="stock up and it lands where it keeps"
				action={
					<Link
						to="/kitchen/bulk"
						className={buttonVariants({
							variant: 'outline',
							className: 'shrink-0 gap-1.5 px-3',
						})}
					>
						<Plus size={14} weight="bold" aria-hidden />
						stock up
					</Link>
				}
			/>
		)

	const shelves = shelvesOf(spot, items)
	const named = shelves.length > 1 && items.length >= shelvesFrom

	const card = (item: PantryItem) => (
		<li key={item.id}>
			<FoodCard
				item={item}
				search={{ spot, item: item.id }}
				selected={item.id === selectedId}
			/>
		</li>
	)

	if (!named)
		return (
			<ul aria-label={pantrySpotLabels[spot]} className={foodGridClassName}>
				{shelves.flatMap((shelf) => shelf.items).map(card)}
			</ul>
		)

	return (
		<section
			aria-label={pantrySpotLabels[spot]}
			className="flex flex-col gap-5"
		>
			{shelves.map((shelf) => (
				<section
					key={shelf.id}
					aria-label={shelf.label}
					className="flex flex-col gap-2"
				>
					<h3 className="text-muted-foreground text-sm font-bold">
						{shelf.label}
					</h3>
					<ul className={foodGridClassName}>{shelf.items.map(card)}</ul>
				</section>
			))}
		</section>
	)
}

// An item's own picture.
function Sprite({ item, className }: { item: PantryItem; className?: string }) {
	return (
		<PantrySprite
			look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
			className={cn(
				'shrink-0 object-contain [image-rendering:pixelated]',
				className,
			)}
		/>
	)
}

// Food bought for a meal whose days are up: probably eaten, maybe not. It
// is not counted on anywhere until the cook says it is still there.
function CheckThese({
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
		<section aria-labelledby="check-these">
			<h2 id="check-these" className="pb-3 text-base font-bold">
				still there?{' '}
				<span className="text-muted-foreground text-sm font-semibold">
					· bought a while back, for a meal
				</span>
			</h2>
			<ul className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
				{items.map((item) => (
					<li
						key={item.id}
						className="flex min-h-11 items-center gap-3 px-3 py-1.5"
					>
						<PantrySprite
							look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
							className="size-6 shrink-0 object-contain [image-rendering:pixelated]"
						/>
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
								className: 'min-h-9 px-3',
							})}
						>
							still have it
						</button>
						<button
							type="button"
							onClick={() => onRemove(item)}
							className={buttonVariants({
								variant: 'ghost',
								className: 'min-h-9 px-3',
							})}
						>
							gone
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}

// Puts pantry items on the groceries list, and says so from the tab.
function BuyButton({ names }: { names: string[] }) {
	const client = useQueryClient()
	const router = useRouter()
	const [adding, setAdding] = useState(false)
	// Once these are on the list the button says so, until the list it
	// offers changes.
	const [sent, setSent] = useState<string>()
	const listed = sent === names.join('\n')

	async function buy() {
		setAdding(true)

		try {
			const added = await addGroceries({
				data: names.map((text) => ({ text })),
			})

			pulseGroceries(added.length)
			setSent(names.join('\n'))
			void client.invalidateQueries({ queryKey: groceryCountKey })
			toast.success(
				added.length
					? `${added.length} added to your list`
					: 'already on your list',
			)
			await router.invalidate()
		} catch {
			toast.error("couldn't add to groceries — try again")
		} finally {
			setAdding(false)
		}
	}

	return (
		<button
			type="button"
			disabled={adding || listed}
			onClick={() => void buy()}
			className="border-input hover:bg-muted/60 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60"
		>
			{listed ? (
				<CheckIcon size={16} weight="bold" aria-hidden />
			) : (
				<ShoppingCartIcon size={16} weight="bold" aria-hidden />
			)}
			{listed
				? 'on your list'
				: names.length === 1
					? 'add to list'
					: `add ${names.length} to list`}
		</button>
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

const byName = (items: PantryItem[]) =>
	[...items].sort((a, b) => a.name.localeCompare(b.name))

// How much is left, in words: a count when the cook keeps one, else the level.
function leftOf(item: PantryItem) {
	return item.quantity === null || item.level === 'out'
		? pantryLevelLabels[item.level]
		: `${item.quantity} left`
}

// The levels as the details offer them, short enough to sit side by side.
// Each with bars for how much is left, all three, one or none, tinted as a
// cook reads a gauge: basil for enough, yolk for low, tomato for out. The
// tints belong to this meter alone.
const levelChoices = {
	plenty: {
		label: 'enough',
		bars: 3,
		tint: 'text-kitchen-basil',
		picked: 'bg-kitchen-basil/20',
	},
	low: {
		label: 'low',
		bars: 1,
		tint: 'text-kitchen-yolk',
		picked: 'bg-kitchen-yolk/25',
	},
	out: {
		label: 'out',
		bars: 0,
		tint: 'text-kitchen-tomato',
		picked: 'bg-kitchen-tomato/20',
	},
} as const

// Three rising bars, as a phone shows its signal: the ones not filled stay
// faint, so every level reads as the same meter.
function LevelIcon({ level }: { level: PantryLevel }) {
	const { bars, tint } = levelChoices[level]

	return (
		<svg
			viewBox="0 0 16 16"
			aria-hidden
			className={cn('size-4 shrink-0 fill-current', tint)}
		>
			{[5, 9, 13].map((height, index) => (
				<rect
					key={height}
					x={1.5 + index * 5}
					y={14 - height}
					width={3}
					height={height}
					rx={1}
					// An empty meter still shows its tint, faintly.
					opacity={index < bars ? 1 : bars ? 0.3 : 0.55}
				/>
			))}
		</svg>
	)
}

function DetailPanel({
	item,
	onRemove,
}: {
	item: PantryItem
	onRemove: () => void
}) {
	const router = useRouter()
	const client = useQueryClient()
	const [pending, setPending] = useState(false)

	// Running low or out put it on the list too; the tab says so.
	function onListed(listed: boolean) {
		if (!listed) return
		pulseGroceries(1)
		void client.invalidateQueries({ queryKey: groceryCountKey })
		toast(`${item.name} is on your list`)
	}

	async function save(send: () => Promise<void>) {
		setPending(true)

		try {
			await send()
			await router.invalidate()
		} catch {
			toast.error("couldn't update how much is left — try again")
		} finally {
			setPending(false)
		}
	}

	const food = foodOf(item.name)
	// Food kept one by one can also say how many, under its level.
	const counted = food?.kind === 'count'
	const packs = counted ? food.packs : []

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3">
				<PantrySprite
					look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
					className="size-7 shrink-0 object-contain [image-rendering:pixelated]"
				/>
				<p className="min-w-0 flex-1 truncate text-lg font-bold">{item.name}</p>
			</div>
			<fieldset className="border-input grid w-full grid-cols-3 overflow-hidden rounded-md border">
				<legend className="sr-only">how much is left</legend>
				{pantryLevels.map((level) => (
					<button
						key={level}
						type="button"
						aria-pressed={item.level === level}
						disabled={pending}
						onClick={() => {
							if (item.level !== level)
								void save(async () => {
									const { listed } = await setPantryItemLevel({
										data: { id: item.id, level },
									})

									onListed(listed)
								})
						}}
						className={cn(
							'flex min-h-11 items-center justify-center gap-1.5 px-2 text-sm font-semibold transition-colors not-first:border-l border-input disabled:opacity-60',
							item.level === level
								? levelChoices[level].picked
								: 'hover:bg-muted/60',
						)}
					>
						<LevelIcon level={level} />
						{levelChoices[level].label}
					</button>
				))}
			</fieldset>
			{counted && item.level !== 'out' ? (
				<Counter
					key={item.quantity ?? 'none'}
					count={item.quantity}
					onCount={(count) =>
						void save(async () => {
							const { listed } = await setPantryItemCount({
								data: { id: item.id, count },
							})

							onListed(listed)
						})
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
							void save(async () => {
								await restockPantryItem({
									data: pack ? { id: item.id, added: pack } : { id: item.id },
								})
							})
						}
						className={buttonVariants({
							variant: 'outline',
							className: 'min-h-11',
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

							void save(async () => {
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
							className: 'min-h-11',
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
