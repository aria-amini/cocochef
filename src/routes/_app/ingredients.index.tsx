import {
	CaretLeft,
	CaretRight,
	CheckIcon,
	MagnifyingGlass,
	Minus,
	Plus,
	ShoppingCartIcon,
	TrashIcon,
	X,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { ItemSheet, ItemSheetDone } from '@/components/item-sheet'
import { PantrySprite } from '@/components/pantry-sprite'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { buttonVariants } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { addGroceries } from '@/lib/groceries/server'
import { categorySprites, filterCatalogItems } from '@/lib/pantry/catalog'
import { foodOf } from '@/lib/pantry/foods'
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
	recipeUsingUp,
	keepPantryItem,
	restockPantryItem,
	restorePantryItem,
	setPantryItemCount,
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

// The page's place: one spot's jars, and the item whose details are open.
const pantrySearch = z.object({
	spot: z.enum(pantrySpots).optional().catch(undefined),
	item: z.string().optional(),
})

export const Route = createFileRoute('/_app/ingredients/')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: pantrySearch,
	loader: () => listPantry(),
	component: PantryPage,
})

type PantryItem = NonNullable<Awaited<ReturnType<typeof listPantry>>>[number]

// A pantry is kept by an account; signed out, the page says so.
function PantryPage() {
	const loaded = Route.useLoaderData()

	if (loaded) return <Pantry loaded={loaded} />

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 md:p-10">
				<h1 className="sr-only">ingredients</h1>
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

// Food that spoils within this many days is worth using first.
const soonDays = 3

// The page leads with at most this much going off, soonest first.
const soonShown = 4

function Pantry({ loaded }: { loaded: PantryItem[] }) {
	const navigate = useNavigate()
	const router = useRouter()

	const { spot, item: selectedId } = Route.useSearch()

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
		void navigate({ to: '/ingredients', search: { spot }, resetScroll: false })

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
	const searching = query.trim().length > 0

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
	const soon = kept
		.filter(
			(item) =>
				item.spoils && item.level !== 'out' && item.daysLeft <= soonDays,
		)
		.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name))

	const wanting = byName(kept.filter((item) => item.level !== 'plenty')).sort(
		(a, b) => Number(b.level === 'out') - Number(a.level === 'out'),
	)

	const inSpot = spot
		? byName(kept.filter((item) => spotOf(item) === spot))
		: []

	const selected = items.find((i) => i.id === selectedId) ?? null

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-7 p-6 pb-28 md:p-10">
				{/* The sidebar says where you are; the page opens on its own controls. */}
				<h1 className="sr-only">ingredients</h1>
				{spot ? (
					<Link
						to="/ingredients"
						className="text-muted-foreground hover:text-foreground -mb-3 inline-flex min-h-9 items-center gap-1 self-start text-sm font-bold transition-colors"
					>
						<CaretLeft size={14} weight="bold" aria-hidden />
						ingredients
					</Link>
				) : null}
				<header className="flex flex-wrap items-center justify-between gap-3">
					{spot ? (
						<h2 className="text-2xl font-bold">
							{pantrySpotLabels[spot]}{' '}
							<span className="text-muted-foreground text-base font-semibold tabular-nums">
								{inSpot.length}
							</span>
						</h2>
					) : items.length ? (
						<label className="bg-card border-input focus-within:border-foreground/40 flex min-h-11 min-w-0 flex-1 basis-56 items-center gap-2 rounded-xl border px-3 transition-colors">
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
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
							/>
							{searching ? (
								<button
									type="button"
									aria-label="clear the search"
									onClick={() => setQuery('')}
									className="text-muted-foreground hover:text-foreground -mr-1 grid size-8 place-items-center rounded-md transition-colors"
								>
									<X size={16} weight="bold" aria-hidden />
								</button>
							) : null}
						</label>
					) : null}
					{/* The shelf's round add: at the row's end on desktop, floating
					    above the tab bar on phones, in thumb's reach. */}
					{items.length > 0 ? (
						<>
							<Link
								to="/ingredients/bulk"
								aria-label="add ingredients"
								title="add ingredients"
								className="bg-kitchen-yolk ml-auto hidden size-12 shrink-0 place-items-center rounded-full transition-colors hover:brightness-95 md:grid"
							>
								<Plus size={22} weight="bold" aria-hidden />
							</Link>
							<Link
								to="/ingredients/bulk"
								aria-label="add ingredients"
								className="bg-kitchen-yolk bottom-fab fixed right-4 z-20 grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95 md:hidden"
							>
								<Plus size={26} weight="bold" aria-hidden />
							</Link>
						</>
					) : null}
				</header>

				{items.length === 0 ? (
					<section className="border-foreground/30 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
						<PantryPreview />
						<div className="flex flex-col gap-1">
							<p className="text-lg font-bold">nothing here yet</p>
							<p className="text-muted-foreground max-w-xs text-sm font-semibold">
								recipes and groceries check here for what you already have
							</p>
						</div>
						<Link
							to="/ingredients/bulk"
							className={buttonVariants({ className: 'min-h-11 gap-1.5' })}
						>
							<Plus size={14} weight="bold" aria-hidden />
							stock up
						</Link>
					</section>
				) : spot ? (
					<JarWall items={inSpot} spot={spot} selectedId={selectedId} />
				) : searching ? (
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
						<NotFound name={query.trim()} onAdded={() => setQuery('')} />
					)
				) : (
					<>
						{toCheck.length ? (
							<CheckThese items={toCheck} onRemove={remove} />
						) : null}
						{soon.length ? <UseSoon items={soon} /> : null}
						{wanting.length ? <Wanting items={wanting} /> : null}
						<OnHand items={kept} />
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
							to: '/ingredients',
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

// A section's name, quiet, over what it holds, with room for one action.
function SectionHeading({
	id,
	children,
	action,
}: {
	id: string
	children: React.ReactNode
	action?: React.ReactNode
}) {
	return (
		<div className="flex min-h-9 items-center justify-between gap-3">
			<h2 id={id} className="text-base font-bold">
				{children}
			</h2>
			{action}
		</div>
	)
}

// How long food has left, in a cook's words, short enough for a pill.
function daysWord(days: number) {
	return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${days} days`
}

// What is going off, soonest first, as cards to pick up; and a recipe on
// the shelf that would use it.
function UseSoon({ items }: { items: PantryItem[] }) {
	const shown = items.slice(0, soonShown)

	const recipe = useQuery({
		queryKey: ['use-up', shown.map((item) => item.name)],
		queryFn: () =>
			recipeUsingUp({ data: { foods: shown.map((item) => item.name) } }),
	})

	return (
		<section aria-labelledby="use-soon" className="flex flex-col gap-3">
			<SectionHeading
				id="use-soon"
				action={
					items.length > 1 ? (
						<span className="text-muted-foreground text-sm font-semibold">
							{items.length} going off
						</span>
					) : null
				}
			>
				use soon
			</SectionHeading>
			<ul className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
				{shown.map((item) => (
					<li key={item.id} className="shrink-0 snap-start">
						<Link
							to="/ingredients"
							search={{ item: item.id }}
							resetScroll={false}
							data-pantry={item.id}
							aria-label={`${item.name}, ${daysWord(item.daysLeft)}`}
							className="bg-card border-border hover:border-foreground/30 flex h-full w-32 flex-col gap-2 rounded-xl border p-3 transition-colors md:w-auto"
						>
							<Sprite item={item} className="size-10" />
							<span className="text-base leading-tight font-bold">
								{item.name}
							</span>
							<span
								className={cn(
									'mt-auto self-start rounded-full px-2 text-xs leading-5 font-bold',
									item.daysLeft <= 1
										? 'bg-kitchen-tomato/15'
										: 'bg-kitchen-yolk/30',
								)}
							>
								{daysWord(item.daysLeft)}
							</span>
						</Link>
					</li>
				))}
			</ul>
			{recipe.data ? (
				<Link
					to="/recipes/$recipeId"
					params={{ recipeId: recipe.data.id }}
					className="bg-card border-border hover:border-foreground/30 flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 transition-colors"
				>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="text-muted-foreground text-xs font-semibold">
							cook with {recipe.data.uses.length > 1 ? 'them' : 'it'}
						</span>
						<span className="truncate text-base font-bold">
							{recipe.data.title}
						</span>
					</span>
					<CaretRight size={16} weight="bold" aria-hidden />
				</Link>
			) : null}
		</section>
	)
}

// What ran out or runs low, out first, as chips to open; one tap puts all
// of it on the groceries.
function Wanting({ items }: { items: PantryItem[] }) {
	return (
		<section aria-labelledby="wanting" className="flex flex-col gap-3">
			<SectionHeading
				id="wanting"
				action={<BuyButton names={items.map((item) => item.name)} />}
			>
				{items.every((item) => item.level === 'out')
					? 'out'
					: items.some((item) => item.level === 'out')
						? 'out & running low'
						: 'running low'}
			</SectionHeading>
			<ul className="flex flex-wrap gap-2">
				{items.map((item) => (
					<li key={item.id}>
						<Link
							to="/ingredients"
							search={{ item: item.id }}
							resetScroll={false}
							data-pantry={item.id}
							aria-label={`${item.name}, ${leftOf(item)}`}
							className={cn(
								'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
								item.level === 'out'
									? 'bg-kitchen-tomato/15 hover:bg-kitchen-tomato/25 border-transparent'
									: 'bg-card border-border hover:border-foreground/30',
							)}
						>
							<Sprite item={item} className="size-5" />
							{item.name}
							{item.level === 'out' ? (
								<span className="text-muted-foreground">out</span>
							) : (
								<LevelIcon level={item.level} />
							)}
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

// Everything else, by where it lives: each spot with how much it holds and
// the one thing worth knowing about it.
function OnHand({ items }: { items: PantryItem[] }) {
	const spots = pantrySpots.flatMap((spot) => {
		const held = items.filter((item) => spotOf(item) === spot)

		return held.length ? [{ spot, held }] : []
	})

	return (
		<section aria-labelledby="on-hand" className="flex flex-col gap-3">
			<SectionHeading id="on-hand">on hand</SectionHeading>
			<ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
				{spots.map(({ spot, held }) => (
					<li key={spot}>
						<Link
							to="/ingredients"
							search={{ spot }}
							aria-label={`${pantrySpotLabels[spot]}, ${held.length}`}
							className="bg-card border-border hover:border-foreground/30 flex h-full items-center gap-3 rounded-xl border p-3 transition-colors"
						>
							<PantrySprite
								look={standardLook({ key: pantrySpotSprites[spot] })}
								className="size-8 shrink-0"
							/>
							<span className="flex min-w-0 flex-col">
								<span className="truncate text-base font-bold">
									{pantrySpotLabels[spot]}
								</span>
								<span className="text-muted-foreground truncate text-xs font-semibold">
									<span className="tabular-nums">{held.length}</span> ·{' '}
									{spotNote(held)}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

// The one thing worth knowing about a spot, most pressing first.
function spotNote(items: PantryItem[]) {
	const going = items.filter(
		(item) => item.spoils && item.level !== 'out' && item.daysLeft <= soonDays,
	).length

	if (going) return `${going} going off`

	const out = items.find((item) => item.level === 'out')

	if (out) return `${out.name} out`

	const low = items.find((item) => item.level === 'low')

	if (low) return `${low.name} low`

	return 'all good'
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
										to="/ingredients"
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
					? `${added.length} added to groceries`
					: 'already on your groceries',
			)
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
				? 'on your groceries'
				: names.length === 1
					? 'add to groceries'
					: `add ${names.length} to groceries`}
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
			to="/ingredients"
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
	const [pending, setPending] = useState(false)

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
									await setPantryItemLevel({ data: { id: item.id, level } })
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
							await setPantryItemCount({ data: { id: item.id, count } })
						})
					}
				/>
			) : null}
			{/* Bought more: a pack's worth onto the count, or just plenty. */}
			<div className="flex flex-wrap gap-2">
				{item.level === 'plenty' ? null : <BuyButton names={[item.name]} />}
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
