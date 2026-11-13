import {
	CheckIcon,
	HourglassMediumIcon,
	type Icon,
	JarLabelIcon,
	MagnifyingGlass,
	Minus,
	Plus,
	ShoppingCartIcon,
	SnowflakeIcon,
	TrashIcon,
	X,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { CountPill } from '@/components/count-pill'
import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { GroceryList, type GroceryItem } from '@/components/grocery-list'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { buttonVariants } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { addGroceries, listGroceries } from '@/lib/groceries/server'
import { categorySprites, filterCatalogItems } from '@/lib/pantry/catalog'
import { findInPantry, foodOf } from '@/lib/pantry/foods'
import {
	pantryCategories,
	pantryCategoryLabels,
	pantryLevelLabels,
	pantryLevels,
	pantryQuantityMax,
	type PantryCategory,
	type PantryLevel,
} from '@/lib/pantry/model'
import {
	createPantryItems,
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
	pantrySpotSprites,
	shelvesOf,
	spotOf,
	type PantrySpot,
} from '@/lib/pantry/spots'
import { resolveSpriteLook } from '@/lib/pantry/sprites'
import { hadItIn } from '@/lib/pantry/status'
import { standardLook } from '@/lib/pantry/tinted-sprites'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { cn } from '@/lib/utils/ui'

// The page's place: one spot's jars, the item whose details are open, and
// whether the kitchen is put away for shopping.
const pantrySearch = z.object({
	spot: z.enum(pantrySpots).optional().catch(undefined),
	item: z.string().optional(),
	shop: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/kitchen/')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: pantrySearch,
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

	const { spot, item: selectedId, shop } = Route.useSearch()

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

	// "Do I have it?": a search looks through everything and shows what
	// matches in one list.
	const [query, setQuery] = useState('')

	const found = new Set(
		filterCatalogItems(
			items.map((item) => item.name),
			query,
		),
	)

	// A food's name or kind first; a shelf's name ("spices") only when no
	// food answers, so "egg" finds the eggs, not all of dairy.
	const named = items.filter(
		(item) => found.has(item.name) || ofKind(item.name, query),
	)

	const matches = byCategory(
		named.length
			? named
			: items.filter((item) => ofShelf(item.category, query)),
	)

	// The page leads with only what asks for something: food going off, and
	// food that ran out or runs low. The rest is on hand, by where it lives.
	// Food that goes off within two weeks, soonest first: what to use first.
	const fresh = kept
		.filter((item) => item.level !== 'out' && item.daysLeft <= horizonDays)
		.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name))

	const wanting = byName(kept.filter((item) => item.level !== 'plenty')).sort(
		(a, b) => Number(b.level === 'out') - Number(a.level === 'out'),
	)

	const inSpot = spot
		? byName(kept.filter((item) => spotOf(item) === spot))
		: []

	const selected = items.find((i) => i.id === selectedId) ?? null

	// Shopping, the kitchen steps aside for the list alone.
	if (shop)
		return (
			<main className="flex-1">
				<div className="flex max-w-3xl flex-col gap-6 p-6 pb-28 md:p-10">
					<Need list={list} wanting={wanting} shopping />
				</div>
			</main>
		)

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-7 p-6 pb-28 md:p-10">
				{/* The sidebar says where you are; the page opens on its own controls. */}
				<h1 className="sr-only">kitchen</h1>
				{items.length === 0 ? (
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
						{/* A list kept before the kitchen is, still shows. */}
						{list.length ? (
							<Need list={list} wanting={wanting} shopping={false} />
						) : null}
					</>
				) : (
					<>
						{toCheck.length ? (
							<CheckThese items={toCheck} onRemove={remove} />
						) : null}
						<OnHand
							items={kept}
							fresh={fresh}
							spot={spot}
							inSpot={inSpot}
							query={query}
							onQuery={setQuery}
							matches={matches}
							selectedId={selectedId}
						/>
						<Need list={list} wanting={wanting} shopping={false} />
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

// A section's name, quiet, over what it holds, with room for one action. Its
// mark says what kind of section it is at a glance down a long page.
function SectionHeading({
	id,
	icon: Mark,
	count,
	children,
	action,
}: {
	id: string
	icon?: Icon | undefined
	count?: number | undefined
	children: React.ReactNode
	action?: React.ReactNode
}) {
	return (
		<div className="flex min-h-9 items-center justify-between gap-3">
			<h2
				id={id}
				className="inline-flex items-center gap-2 text-base font-bold"
			>
				{Mark ? <Mark size={18} weight="bold" aria-hidden /> : null}
				{children}
				{count ? <CountPill count={count} /> : null}
			</h2>
			{action}
		</div>
	)
}

// How long food has left, in a cook's words, short enough for a pill.
function daysWord(days: number) {
	return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`
}

// How long food has left, in a pill: tomato for today and tomorrow,
// yolk for the rest of the week, quiet after.
function DaysPill({ days, className }: { days: number; className?: string }) {
	return (
		<span
			className={cn(
				'rounded-full px-2 text-xs leading-5 font-bold whitespace-nowrap',
				days <= 1
					? 'bg-kitchen-tomato/15'
					: days <= weekDays
						? 'bg-kitchen-yolk/30'
						: 'bg-muted',
				className,
			)}
		>
			{daysShort(days)}
		</span>
	)
}

// Days left, said shorter the further off they are: "tomorrow", "5 days",
// "3 wks", "4 mo", "2 yr".
function daysShort(days: number) {
	if (days < 14) return daysWord(days)

	if (days < 60) return `${Math.round(days / 7)} wks`

	if (days < 365) return `${Math.round(days / 30)} mo`

	return `${Math.round(days / 365)} yr`
}

// Fresh food, soonest to go first, as cards to pick up, each with its days
// left.
function GoingOff({ items }: { items: PantryItem[] }) {
	const [all, setAll] = useState(false)
	const shown = all ? items : items.slice(0, firstShown)

	return (
		<div className="flex flex-col gap-3">
			<ul
				aria-label="use first"
				className="grid grid-cols-3 gap-2 md:grid-cols-5"
			>
				{shown.map((item) => (
					<li key={item.id}>
						<Link
							to="/kitchen"
							search={{ item: item.id }}
							resetScroll={false}
							data-pantry={item.id}
							aria-label={`${item.name}, ${daysWord(item.daysLeft)}`}
							className="bg-card border-border hover:border-foreground/30 flex h-full flex-col gap-1.5 rounded-xl border p-2.5 transition-colors"
						>
							<Sprite item={item} className="size-8" />
							<span className="text-sm leading-tight font-bold">
								{item.name}
							</span>
							<DaysPill days={item.daysLeft} className="mt-auto self-start" />
						</Link>
					</li>
				))}
			</ul>
			{items.length > firstShown ? (
				<button
					type="button"
					aria-expanded={all}
					onClick={() => setAll((now) => !now)}
					className="text-muted-foreground hover:text-foreground min-h-10 self-start rounded-md px-1 text-sm font-bold transition-colors"
				>
					{all ? 'show fewer' : `show all ${items.length}`}
				</button>
			) : null}
		</div>
	)
}

// What the kitchen needs: the grocery list itself, to tick, change and add
// to, each line saying why when the kitchen knows (out, low, or the recipe it
// is for); and below it what ran out or runs low but is not on it yet.
function Need({
	list,
	wanting,
	shopping,
}: {
	list: GroceryItem[]
	wanting: PantryItem[]
	shopping: boolean
}) {
	const navigate = useNavigate()
	const waiting = list.filter((line) => !line.checkedAt)

	const unlisted = wanting.filter(
		(item) => !waiting.some((line) => findInPantry(line.text, [item])),
	)

	return (
		<GroceryList
			saved={list}
			shopping={shopping}
			noteOf={(line) => (
				<NeedNote line={line} kept={findInPantry(line.text, wanting)} />
			)}
			onShop={() => void navigate({ to: '/kitchen', search: { shop: true } })}
			onDone={() => void navigate({ to: '/kitchen' })}
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

// What the kitchen holds, under one heading. A row of chips picks what to
// look at: the fresh food to use first (the default, so the page leads with
// it, its count what goes within two weeks), or one spot's jars. The freezer is always there, dashed while
// nothing is in it. "Do I have it?" is asked here, of everything in the
// kitchen, and stocking up starts here too.
function OnHand({
	items,
	fresh,
	spot,
	inSpot,
	query,
	onQuery,
	matches,
	selectedId,
}: {
	items: PantryItem[]
	// Food that goes off within two weeks, soonest first.
	fresh: PantryItem[]
	// The spot picked, and what it holds; none picked shows what is going off.
	spot: PantrySpot | undefined
	inSpot: PantryItem[]
	query: string
	onQuery: (query: string) => void
	matches: PantryItem[]
	selectedId: string | undefined
}) {
	const [finding, setFinding] = useState(false)
	const searching = query.trim().length > 0

	const spots = pantrySpots.flatMap((each) => {
		const held = items.filter((item) => spotOf(item) === each)

		return held.length || each === 'freezer' ? [{ spot: each, held }] : []
	})

	function stopFinding() {
		onQuery('')
		setFinding(false)
	}

	return (
		<section aria-labelledby="on-hand" className="flex flex-col gap-3">
			<SectionHeading
				id="on-hand"
				icon={JarLabelIcon}
				count={items.length}
				action={
					<div className="flex items-center gap-2">
						<button
							type="button"
							aria-label="find an ingredient"
							aria-pressed={finding}
							onClick={() => (finding ? stopFinding() : setFinding(true))}
							className={buttonVariants({
								variant: finding ? 'saved' : 'outline',
								className: 'px-3',
							})}
						>
							<MagnifyingGlass size={16} weight="bold" aria-hidden />
						</button>
						<Link
							to="/kitchen/bulk"
							className={buttonVariants({
								variant: 'outline',
								className: 'gap-1.5 px-3',
							})}
						>
							<Plus size={14} weight="bold" aria-hidden />
							stock up
						</Link>
					</div>
				}
			>
				on hand
			</SectionHeading>
			{finding ? (
				<label className="bg-card border-input focus-within:border-foreground/40 flex min-h-11 items-center gap-2 rounded-xl border px-3 transition-colors">
					<MagnifyingGlass
						size={18}
						weight="bold"
						aria-hidden
						className="text-muted-foreground shrink-0"
					/>
					<input
						type="search"
						aria-label="find an ingredient"
						placeholder="do i have…"
						// Opened by a tap to look something up, so the keyboard comes up.
						// eslint-disable-next-line jsx-a11y/no-autofocus
						autoFocus
						value={query}
						onChange={(event) => onQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Escape') stopFinding()
						}}
						className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
					/>
					<button
						type="button"
						aria-label="close the search"
						onClick={stopFinding}
						className="text-muted-foreground hover:text-foreground -mr-1 grid size-8 place-items-center rounded-md transition-colors"
					>
						<X size={16} weight="bold" aria-hidden />
					</button>
				</label>
			) : null}
			{searching ? (
				matches.length ? (
					<ul
						aria-label="matches"
						className="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border"
					>
						{matches.map((item) => (
							<li key={item.id}>
								<Row item={item} selected={item.id === selectedId} />
							</li>
						))}
					</ul>
				) : (
					<NotFound name={query.trim()} onAdded={stopFinding} />
				)
			) : (
				<>
					{/* On a phone the chips run off the edge to scroll; on a wide
					    screen they wrap. */}
					<ul
						aria-label="what to show"
						className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
					>
						<li className="shrink-0">
							<SpotChip
								label="use first"
								count={fresh.length}
								picked={!spot}
								search={{}}
								mark={
									<HourglassMediumIcon size={16} weight="bold" aria-hidden />
								}
							/>
						</li>
						{spots.map(({ spot: each, held }) => (
							<li key={each} className="shrink-0">
								<SpotChip
									label={pantrySpotLabels[each]}
									count={held.length}
									picked={each === spot}
									search={{ spot: each }}
									mark={
										<PantrySprite
											look={standardLook({ key: pantrySpotSprites[each] })}
											className={cn('size-5', !held.length && 'opacity-50')}
										/>
									}
								/>
							</li>
						))}
					</ul>
					{spot ? (
						<JarWall items={inSpot} spot={spot} selectedId={selectedId} />
					) : fresh.length ? (
						<GoingOff items={fresh} />
					) : (
						<p className="text-muted-foreground text-sm font-semibold">
							nothing goes off in the next two weeks
						</p>
					)}
				</>
			)}
		</section>
	)
}

// One chip in the row: its mark, its name and how many it holds. The one
// picked is yolk; a spot with nothing in it is dashed.
function SpotChip({
	label,
	count,
	picked,
	search,
	mark,
}: {
	label: string
	count: number
	picked: boolean
	search: { spot?: PantrySpot }
	mark: React.ReactNode
}) {
	return (
		<Link
			to="/kitchen"
			search={search}
			resetScroll={false}
			aria-current={picked ? 'true' : undefined}
			className={cn(
				'hover:border-foreground/30 inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold whitespace-nowrap transition-colors',
				picked
					? 'bg-kitchen-yolk/30 border-kitchen-yolk'
					: count
						? 'bg-card border-border'
						: 'border-foreground/30 border-dashed',
			)}
		>
			{mark}
			{label}
			{count ? (
				<span className="text-muted-foreground tabular-nums">{count}</span>
			) : null}
		</Link>
	)
}

// One spot's food as a wall of jars, a screenful at a glance rather than a
// long list: a dashed, struck jar ran out, a yolk one runs low. A jar opens
// its details.
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
			<p className="text-muted-foreground text-sm font-semibold">
				nothing in the {pantrySpotLabels[spot]} yet
			</p>
		)

	const shelves = shelvesOf(spot, items)

	// One shelf needs no name over it.
	const named = shelves.length > 1

	return (
		<section
			aria-label={pantrySpotLabels[spot]}
			className="flex flex-col gap-6"
		>
			{shelves.map((shelf) => (
				<section
					key={shelf.id}
					aria-label={named ? shelf.label : undefined}
					className="flex flex-col gap-3"
				>
					{named ? (
						<h3 className="text-muted-foreground text-sm font-bold">
							{shelf.label}{' '}
							<span className="font-semibold tabular-nums">
								· {shelf.items.length}
							</span>
						</h3>
					) : null}
					<ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-4">
						{shelf.items.map((item) => {
							const out = item.level === 'out'

							return (
								<li key={item.id}>
									<Link
										to="/kitchen"
										search={{ spot, item: item.id }}
										resetScroll={false}
										data-pantry={item.id}
										aria-label={`${item.name}, ${leftOf(item)}`}
										aria-current={item.id === selectedId ? 'true' : undefined}
										className="group/jar flex flex-col items-center gap-1.5 text-center"
									>
										<span
											className={cn(
												'grid size-14 place-items-center rounded-xl border transition-colors',
												out
													? 'border-foreground/35 border-dashed'
													: item.level === 'low'
														? 'bg-kitchen-yolk/30 border-transparent'
														: 'bg-card border-border group-hover/jar:border-foreground/30',
												item.id === selectedId &&
													'border-foreground/45 border-solid',
											)}
										>
											<Sprite
												item={item}
												className={cn('size-8', out && 'opacity-40 grayscale')}
											/>
										</span>
										<span
											className={cn(
												'text-xs leading-tight font-semibold',
												out && 'text-muted-foreground line-through',
											)}
										>
											{item.name}
										</span>
										{/* Each jar says how long it has left. */}
										{!out ? (
											<DaysPill days={item.daysLeft} className="-mt-0.5" />
										) : null}
									</Link>
								</li>
							)
						})}
					</ul>
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

// A search that finds nothing: the cook may have it and never said, or may
// want it.
function NotFound({ name, onAdded }: { name: string; onAdded: () => void }) {
	const router = useRouter()
	const [adding, setAdding] = useState(false)

	async function add() {
		setAdding(true)

		try {
			await createPantryItems({
				data: [
					{ name: name.toLowerCase(), category: ingredientCategory(name) },
				],
			})
			await router.invalidate()
			toast.success(`${name.toLowerCase()} added to ingredients`)
			onAdded()
		} catch {
			toast.error(`couldn't add ${name.toLowerCase()} — try again`)
		} finally {
			setAdding(false)
		}
	}

	// Half a word is not a food: "i have" waits for one the catalog knows.
	const known = !!foodOf(name)

	return (
		<section
			aria-label="not found"
			className="flex flex-col items-start gap-3 px-1"
		>
			<p className="text-muted-foreground text-sm font-semibold">
				no {name} in your ingredients
			</p>
			<div className="flex flex-wrap gap-2">
				{known ? (
					<button
						type="button"
						disabled={adding}
						onClick={() => void add()}
						className="border-input hover:bg-muted/60 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60"
					>
						<Plus size={16} weight="bold" aria-hidden />
						i have {name.toLowerCase()}
					</button>
				) : null}
				<BuyButton names={[name]} />
			</div>
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

// Words a cook searches by that name a kind of food, not a food.
const kinds = new Map([
	[
		'cheese',
		[
			'cheddar',
			'mozzarella',
			'parmesan',
			'feta',
			'goat cheese',
			'brie',
			'gruyere',
			'ricotta',
			'cream cheese',
			'cottage cheese',
		],
	],
	['fish', ['salmon', 'cod', 'tilapia', 'tuna steak', 'canned tuna']],
	['seafood', ['shrimp', 'scallops', 'salmon', 'cod', 'tilapia']],
	[
		'herbs',
		[
			'cilantro',
			'parsley',
			'fresh basil',
			'fresh thyme',
			'oregano',
			'dried thyme',
			'bay leaves',
		],
	],
	[
		'beans',
		['black beans', 'chickpeas', 'kidney beans', 'green beans', 'lentils'],
	],
	['nuts', ['almonds', 'walnuts', 'peanuts', 'peanut butter']],
	['berries', ['strawberries', 'blueberries', 'raspberries']],
	['pasta', ['spaghetti', 'pasta']],
	['oil', ['olive oil', 'vegetable oil', 'sesame oil']],
	[
		'vinegar',
		[
			'white vinegar',
			'balsamic vinegar',
			'red wine vinegar',
			'rice vinegar',
			'apple cider vinegar',
		],
	],
])

// Whether a search names a kind of food this item is: "cheese" finds
// cheddar, "fish" finds salmon.
function ofKind(name: string, query: string) {
	const word = query.trim().toLowerCase()

	if (word.length < 3) return false

	return [...kinds].some(
		([kind, names]) =>
			(kind.startsWith(word) || word.startsWith(kind.replace(/s$/, ''))) &&
			names.includes(name.toLowerCase()),
	)
}

// Whether a search names the shelf an item sits on: "spice" finds the
// spices, "herbs" the vegetables and herbs.
function ofShelf(category: PantryCategory, query: string) {
	const word = query.trim().toLowerCase().replace(/s$/, '')

	if (word.length < 3) return false

	return pantryCategoryLabels[category]
		.split(/\W+/)
		.some((part) => part.length > 3 && part.replace(/s$/, '') === word)
}

const byName = (items: PantryItem[]) =>
	[...items].sort((a, b) => a.name.localeCompare(b.name))

// A long section in the shelf's order, then by name, for its light labels.
function byCategory(items: PantryItem[]) {
	return [...items].sort(
		(a, b) =>
			pantryCategories.indexOf(a.category) -
				pantryCategories.indexOf(b.category) || a.name.localeCompare(b.name),
	)
}

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

// What a row says beside its name, if anything is worth noticing. Every note
// is one small pill, tinted only when it asks for something.
function noteOf(item: PantryItem) {
	if (item.level === 'out') return { text: 'out', tone: 'note' } as const

	if (item.quantity !== null)
		return {
			text: `× ${item.quantity}`,
			tone: item.level === 'low' ? 'low' : 'note',
		} as const

	if (item.level === 'low') return { text: 'running low', tone: 'low' } as const

	// Food about to spoil says so, wherever it is listed.
	if (item.spoils && item.daysLeft <= 2)
		return { text: keepsFor(item.daysLeft), tone: 'low' } as const

	if (item.stale)
		return { text: hadItIn(item.confirmedAt), tone: 'note' } as const

	return null
}

function Row({ item, selected }: { item: PantryItem; selected: boolean }) {
	const out = item.level === 'out'
	const note = noteOf(item)

	return (
		<Link
			to="/kitchen"
			search={{ item: item.id }}
			resetScroll={false}
			data-pantry={item.id}
			aria-label={`${item.name}, ${leftOf(item)}`}
			aria-current={selected ? 'true' : undefined}
			className={cn(
				'flex min-h-11 items-center gap-3 px-3 py-1.5 transition-colors',
				selected ? 'bg-kitchen-yolk/30' : 'hover:bg-muted/60',
			)}
		>
			<PantrySprite
				look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
				className={cn(
					'size-6 shrink-0 object-contain [image-rendering:pixelated]',
					out && 'opacity-35 grayscale',
				)}
			/>
			<span
				className={cn(
					'min-w-0 flex-1 truncate text-base',
					out && 'text-muted-foreground',
				)}
			>
				{item.name}
			</span>
			{note ? (
				<span
					className={cn(
						'shrink-0 rounded-full px-2 text-xs leading-5 font-semibold whitespace-nowrap',
						note.tone === 'low'
							? 'bg-kitchen-yolk/30'
							: note.tone === 'note'
								? 'bg-foreground/5'
								: 'text-muted-foreground',
					)}
				>
					{note.text}
				</span>
			) : null}
		</Link>
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
