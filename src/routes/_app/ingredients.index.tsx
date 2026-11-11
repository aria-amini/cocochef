import { Dialog } from '@base-ui/react/dialog'
import {
	CaretDown,
	MagnifyingGlass,
	Minus,
	Plus,
	ShoppingCartIcon,
	X,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { Fragment, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { addGroceries } from '@/lib/groceries/server'
import {
	categorySprites,
	filterCatalogItems,
	findCatalogSection,
} from '@/lib/pantry/catalog'
import {
	pantryViews,
	useFoldedSections,
	type PantryView,
} from '@/lib/pantry/folded'
import { foodOf } from '@/lib/pantry/foods'
import {
	pantryCategories,
	pantryCategoryLabels,
	pantryLevelLabels,
	pantryLevels,
	pantryQuantityMax,
	pantrySearch,
	type PantryCategory,
	type PantryLevel,
} from '@/lib/pantry/model'
import {
	deletePantryItem,
	listPantry,
	setPantryItemCount,
	setPantryItemLevel,
} from '@/lib/pantry/server'
import { resolveSpriteSrc } from '@/lib/pantry/sprites'
import { hadItIn } from '@/lib/pantry/status'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/ingredients/')({
	// Adding floats above the tab bar on phones, as on the shelf.
	staticData: { tabBar: 'own-fab' },
	validateSearch: pantrySearch,
	loader: () => listPantry(),
	component: Pantry,
})

type PantryItem = Awaited<ReturnType<typeof listPantry>>[number]

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

// Bulk add opens straight into a category when the catalog has one for it.
function bulkSearch(category: PantryCategory | undefined) {
	return { cat: findCatalogSection(category)?.id }
}

function Pantry() {
	const navigate = useNavigate()

	const wide = useSyncExternalStore(
		subscribeWide,
		() => matchMedia('(min-width: 1024px)').matches,
		() => true,
	)

	const items = Route.useLoaderData()
	const { cat, by, item: selectedId } = Route.useSearch()
	const view: PantryView = by ?? 'category'
	const { folded, setFolded } = useFoldedSections(view)

	const stocked = pantryCategories.filter((category) =>
		items.some((item) => item.category === category),
	)

	// "Do I have it?": a search shows only what matches, every group open.
	const [query, setQuery] = useState('')
	const searching = query.trim().length > 0

	const found = new Set(
		filterCatalogItems(
			items.map((item) => item.name),
			query,
		),
	)

	const groups = sectionsOf(
		view,
		items.filter((item) => found.has(item.name)),
		cat ? [cat] : stocked,
	)

	const visible = groups.flatMap((group) => group.items)

	const selected =
		visible.find((i) => i.id === selectedId) ?? visible[0] ?? null

	return (
		<main className="flex-1">
			<div className="flex max-w-5xl flex-col gap-6 p-6 md:p-10">
				{/* The sidebar says where you are; the page opens on its own controls. */}
				<h1 className="sr-only">ingredients</h1>
				<header className="flex flex-wrap items-center justify-between gap-3">
					{items.length ? (
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
								placeholder="find an ingredient"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none"
							/>
						</label>
					) : null}
					{/* The shelf's round add: at the row's end on desktop, floating
					    above the tab bar on phones, in thumb's reach. */}
					{items.length > 0 ? (
						<>
							<Link
								to="/ingredients/bulk"
								search={bulkSearch(cat)}
								aria-label="add ingredients"
								title="add ingredients"
								className="bg-kitchen-yolk ml-auto hidden size-12 shrink-0 place-items-center rounded-full transition-colors hover:brightness-95 md:grid"
							>
								<Plus size={22} weight="bold" aria-hidden />
							</Link>
							<Link
								to="/ingredients/bulk"
								search={bulkSearch(cat)}
								aria-label="add ingredients"
								className="bg-kitchen-yolk bottom-fab fixed right-4 z-20 grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95 md:hidden"
							>
								<Plus size={26} weight="bold" aria-hidden />
							</Link>
						</>
					) : null}
				</header>

				{items.length ? <ViewTabs view={view} /> : null}

				{items.length === 0 ? (
					<section className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border p-10 text-center">
						<div aria-hidden className="flex gap-3">
							{emptyPreview.map((category) => (
								<img
									key={category}
									src={`/sprites/pantry/${categorySprites[category]}.png`}
									alt=""
									className="size-10 [image-rendering:pixelated]"
								/>
							))}
						</div>
						<p className="text-lg font-bold">nothing here yet</p>
						<Link
							to="/ingredients/bulk"
							className="bg-kitchen-yolk flex min-h-11 items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold"
						>
							<Plus size={14} weight="bold" aria-hidden />
							stock up
						</Link>
					</section>
				) : (
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
						{searching && !groups.length ? (
							<p className="text-muted-foreground flex-1 px-1 text-sm font-semibold">
								no {query.trim()} in your ingredients
							</p>
						) : null}
						{/* A compact list by category: small pictures, names to read,
						    and only what is worth noticing about how much is left. */}
						<div className="flex min-w-0 flex-1 flex-col gap-5">
							{groups.map((group) => {
								// The one category asked for is always open.
								const shown = !!cat && cat === group.category

								return (
									<details
										key={group.id}
										aria-label={group.label}
										// Open while searching, or when it is the one category shown.
										open={searching || shown || !folded.has(group.id)}
										// Only the cook's own fold is remembered: the browser also
										// reports the page opening a group, or a search doing so.
										onToggle={(event) => {
											const open = event.currentTarget.open

											if (!searching && !shown && open === folded.has(group.id))
												setFolded(group.id, !open)
										}}
										className="group/fold"
									>
										<summary className="text-muted-foreground hover:text-foreground flex min-h-9 cursor-pointer list-none items-center gap-1.5 px-1 pb-1 text-sm font-bold transition-colors [&::-webkit-details-marker]:hidden">
											<CaretDown
												size={12}
												weight="bold"
												aria-hidden
												className="-rotate-90 transition-transform group-open/fold:rotate-0"
											/>
											<h2>{group.label}</h2>
											{/* Folded, it still says how many, and if any want buying. */}
											<span className="font-normal group-open/fold:hidden">
												{group.items.length}
											</span>
											{view === 'category' &&
											group.items.some((item) => item.level !== 'plenty') ? (
												<span className="bg-kitchen-yolk/30 text-foreground rounded-full px-2 text-xs leading-5 font-semibold group-open/fold:hidden">
													{
														group.items.filter(
															(item) => item.level !== 'plenty',
														).length
													}{' '}
													low
												</span>
											) : null}
										</summary>
										<ul className="bg-card border-input divide-border divide-y overflow-hidden rounded-xl border">
											{group.items.map((item, index) => {
												// A long section breaks quietly by category.
												const mixed =
													new Set(group.items.map((entry) => entry.category))
														.size > 1

												const label =
													group.byCategory &&
													mixed &&
													item.category !== group.items[index - 1]?.category
														? pantryCategoryLabels[item.category]
														: null

												return (
													<Fragment key={item.id}>
														{label ? (
															<li
																aria-hidden
																className="text-muted-foreground border-b-0! px-3 pt-2.5 pb-0.5 text-xs font-semibold"
															>
																{label}
															</li>
														) : null}
														<li>
															<Row
																item={item}
																// A phone shows no details until a row is tapped.
																selected={
																	item.id === selected?.id &&
																	(wide || !!selectedId)
																}
															/>
														</li>
													</Fragment>
												)
											})}
											{/* What to buy again goes on the list in one tap. */}
											{group.buy && !searching ? (
												<li className="flex min-h-11 items-center px-3 py-1.5">
													<BuyButton
														names={group.items.map((item) => item.name)}
													/>
												</li>
											) : null}
											{group.category && view === 'category' && !searching ? (
												<li>
													<Link
														to="/ingredients/bulk"
														search={bulkSearch(group.category)}
														aria-label={`Add ${group.label}`}
														className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-3 px-3 text-sm font-semibold transition-colors"
													>
														<span className="border-foreground/40 grid size-6 place-items-center rounded-md border border-dashed">
															<Plus size={12} weight="bold" aria-hidden />
														</span>
														add
													</Link>
												</li>
											) : null}
										</ul>
									</details>
								)
							})}
						</div>

						<DetailPanel
							item={selected}
							className="hidden lg:block lg:w-80 lg:shrink-0"
						/>
					</div>
				)}
			</div>

			{!wide && selectedId && selected ? (
				<Dialog.Root
					open
					onOpenChange={(open) => {
						if (!open)
							void navigate({ to: '/ingredients', search: { cat, by } })
					}}
				>
					<Dialog.Portal>
						<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
						<Dialog.Popup
							aria-describedby={undefined}
							className="bg-card fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto outline-none"
						>
							<Dialog.Title className="sr-only">
								Ingredient details
							</Dialog.Title>
							<Dialog.Close
								aria-label="Close details"
								className="border-border bg-background absolute top-3 right-3 rounded-md border p-2"
							>
								<X size={18} aria-hidden />
							</Dialog.Close>
							<DetailPanel item={selected} />
						</Dialog.Popup>
					</Dialog.Portal>
				</Dialog.Root>
			) : null}
		</main>
	)
}

function subscribeWide(notify: () => void) {
	const query = matchMedia('(min-width: 1024px)')
	query.addEventListener('change', notify)

	return () => query.removeEventListener('change', notify)
}

// Puts pantry items on the groceries list, and says so from the tab.
function BuyButton({ names }: { names: string[] }) {
	const client = useQueryClient()
	const [adding, setAdding] = useState(false)

	async function buy() {
		setAdding(true)

		try {
			const added = await addGroceries({
				data: names.map((text) => ({ text })),
			})

			pulseGroceries(added.length)
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
			disabled={adding}
			onClick={() => void buy()}
			className="border-input hover:bg-muted/60 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-60"
		>
			<ShoppingCartIcon size={16} weight="bold" aria-hidden />
			{names.length === 1
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

type Section = {
	id: string
	label: string
	items: PantryItem[]
	// The category a section stands for, to add to it.
	category?: PantryCategory | undefined
	// Whether its items want buying again, one tap from the list.
	buy?: boolean
	// Sorted by category, with a light label where each one starts.
	byCategory?: boolean
}

// The list's sections for a grouping, each in a useful order and none
// empty. By category, in the shelf's order; by freshness, what spoils
// soonest first, from days to what never really spoils; by amount
// left, what is gone first.
function sectionsOf(
	view: PantryView,
	items: PantryItem[],
	categories: PantryCategory[],
): Section[] {
	const sections: Section[] =
		view === 'category'
			? categories.map((category) => ({
					id: category,
					label: pantryCategoryLabels[category],
					category,
					items: items.filter((item) => item.category === category),
				}))
			: view === 'freshness'
				? [
						{
							id: 'soon',
							label: 'use soon',
							items: spoilingIn(items, 0, 2),
						},
						{
							id: 'week',
							label: 'this week',
							items: spoilingIn(items, 3, 7),
						},
						{
							id: 'weeks',
							label: 'in a few weeks',
							items: byCategory(spoilingIn(items, 8, 30)),
							byCategory: true,
						},
						{
							id: 'months',
							label: 'in a few months',
							items: byCategory(spoilingIn(items, 31, 365)),
							byCategory: true,
						},
						{
							id: 'years',
							label: 'non-perishable',
							items: byCategory(spoilingIn(items, 366, Infinity)),
							byCategory: true,
						},
					]
				: [
						{
							id: 'out',
							label: 'out',
							buy: true,
							items: items.filter((item) => item.level === 'out'),
						},
						{
							id: 'low',
							label: 'running low',
							buy: true,
							items: items.filter((item) => item.level === 'low'),
						},
						{
							id: 'plenty',
							label: 'have it',
							items: items.filter((item) => item.level === 'plenty'),
						},
					]

	return sections.filter((section) => section.items.length)
}

const viewLabels: Record<PantryView, string> = {
	category: 'category',
	freshness: 'freshness',
	stock: 'amount left',
}

// A long section in the shelf's order, then by name, for its light labels.
function byCategory(items: PantryItem[]) {
	return [...items].sort(
		(a, b) =>
			pantryCategories.indexOf(a.category) -
				pantryCategories.indexOf(b.category) || a.name.localeCompare(b.name),
	)
}

// Food in the kitchen that spoils between some days from now, soonest
// first. What ran out has nothing left to spoil, so freshness leaves it out.
function spoilingIn(items: PantryItem[], from: number, to: number) {
	return items
		.filter(
			(item) =>
				item.level !== 'out' &&
				// Without an estimate, a food is taken to keep.
				(item.daysLeft ?? Infinity) >= from &&
				(item.daysLeft ?? Infinity) <= to,
		)
		.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity))
}

// How the list is grouped, one tap to change.
function ViewTabs({ view }: { view: PantryView }) {
	return (
		<nav
			aria-label="group by"
			className="border-input -mt-2 grid w-full max-w-sm grid-cols-3 overflow-hidden rounded-md border"
		>
			{pantryViews.map((option) => (
				<Link
					key={option}
					to="/ingredients"
					search={(prev) => ({
						cat: prev.cat,
						by: option === 'category' ? undefined : option,
					})}
					aria-current={option === view ? 'page' : undefined}
					className={cn(
						'border-input grid min-h-10 place-items-center px-2 text-sm font-semibold transition-colors not-first:border-l',
						option === view ? 'bg-kitchen-yolk/40' : 'hover:bg-muted/60',
					)}
				>
					{viewLabels[option]}
				</Link>
			))}
		</nav>
	)
}

// How much is left, in words: a count when the cook keeps one, else the level.
function leftOf(item: PantryItem) {
	return item.quantity === null
		? pantryLevelLabels[item.level]
		: `${item.quantity} left`
}

// A row says how much is left only when it is worth noticing: a count, a
// food running low or run out, or one not confirmed in a while. One that ran
// out stays, faded, to buy again.
function Row({ item, selected }: { item: PantryItem; selected: boolean }) {
	const out = item.level === 'out'

	const note =
		item.quantity !== null && !out
			? `× ${item.quantity}`
			: item.level === 'low'
				? 'running low'
				: out
					? 'out'
					: item.stale
						? hadItIn(item.confirmedAt)
						: // Food that spoils says how long it has been in the kitchen.
							item.spoils
							? boughtAgo(item.boughtDaysAgo)
							: null

	return (
		<Link
			to="/ingredients"
			search={(prev) => ({ cat: prev.cat, by: prev.by, item: item.id })}
			aria-label={`${item.name}, ${leftOf(item)}`}
			aria-current={selected ? 'true' : undefined}
			className={cn(
				'flex min-h-11 items-center gap-3 px-3 py-1.5 transition-colors',
				selected ? 'bg-kitchen-yolk/30' : 'hover:bg-muted/60',
			)}
		>
			<img
				src={resolveSpriteSrc(item.name, item.spriteKey, item.category)}
				alt=""
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
						item.quantity !== null && !out
							? 'font-mono'
							: item.level === 'low'
								? 'bg-kitchen-yolk/30'
								: 'bg-foreground/5',
					)}
				>
					{note}
				</span>
			) : null}
		</Link>
	)
}

function DetailPanel({
	item,
	className = '',
}: {
	item: PantryItem | null
	className?: string
}) {
	const router = useRouter()
	const navigate = useNavigate()
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

	const setLevel = (id: string, level: PantryLevel) =>
		save(async () => {
			await setPantryItemLevel({ data: { id, level } })
		})

	const setCount = (id: string, count: number) =>
		save(async () => {
			await setPantryItemCount({ data: { id, count } })
		})

	const food = item ? foodOf(item.name) : undefined

	async function remove(itemId: string) {
		setPending(true)

		try {
			await deletePantryItem({ data: { id: itemId } })
			await navigate({
				to: '/ingredients',
				search: (prev) => ({ cat: prev.cat, by: prev.by }),
			})
			await router.invalidate()
		} catch {
			toast.error("couldn't remove that ingredient — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<aside
			aria-label="Item details"
			className={cn('border-border bg-card border p-5 rounded-xl', className)}
		>
			{item ? (
				<div className="flex flex-col items-center gap-4">
					<img
						src={resolveSpriteSrc(item.name, item.spriteKey, item.category)}
						alt=""
						className="size-20 object-contain [image-rendering:pixelated]"
					/>
					<h2 className="text-2xl font-bold tracking-tight lowercase">
						{item.name}
					</h2>
					<fieldset className="border-input grid w-full grid-cols-3 overflow-hidden rounded-md border">
						<legend className="sr-only">how much is left</legend>
						{pantryLevels.map((level) => (
							<button
								key={level}
								type="button"
								aria-pressed={item.level === level}
								disabled={pending}
								onClick={() => {
									if (item.level !== level || item.quantity !== null)
										void setLevel(item.id, level)
								}}
								className={cn(
									'min-h-10 px-2 text-sm font-semibold transition-colors not-first:border-l border-input disabled:opacity-60',
									item.level === level
										? 'bg-kitchen-yolk/40'
										: 'hover:bg-muted/60',
								)}
							>
								{pantryLevelLabels[level]}
							</button>
						))}
					</fieldset>
					{item.level === 'plenty' ? null : <BuyButton names={[item.name]} />}
					{food?.kind === 'count' ? (
						<Counter
							count={item.quantity}
							packs={food.packs}
							pending={pending}
							onCount={(count) => void setCount(item.id, count)}
						/>
					) : null}
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
								{dateFormat.format(item.boughtAt)}
							</dd>
						</div>
					</dl>
					<button
						type="button"
						disabled={pending}
						onClick={() => remove(item.id)}
						className="mt-1 text-xs font-semibold underline underline-offset-4 disabled:opacity-40"
					>
						remove from ingredients
					</button>
				</div>
			) : (
				<p className="text-muted-foreground py-8 text-center text-xs">
					pick a slot to see what&apos;s inside
				</p>
			)}
		</aside>
	)
}

// A count for food kept one by one: step it, or add a whole pack. With no
// count kept yet, it shows a dash and the level alone says how much is left.
function Counter({
	count,
	packs,
	pending,
	onCount,
}: {
	count: number | null
	packs: readonly number[]
	pending: boolean
	onCount: (count: number) => void
}) {
	const now = count ?? 0

	const stepClassName =
		'border-border bg-background hover:bg-kitchen-yolk/40 flex size-9 items-center justify-center rounded-md border disabled:opacity-40'

	return (
		<div className="flex flex-col items-center gap-2">
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label="one fewer"
					disabled={pending || now <= 0}
					onClick={() => onCount(now - 1)}
					className={stepClassName}
				>
					<Minus size={16} weight="bold" aria-hidden />
				</button>
				<output
					aria-label="count"
					className="min-w-16 text-center font-mono text-2xl font-bold"
				>
					{count === null ? '–' : `× ${count}`}
				</output>
				<button
					type="button"
					aria-label="one more"
					disabled={pending || now >= pantryQuantityMax}
					onClick={() => onCount(now + 1)}
					className={stepClassName}
				>
					<Plus size={16} weight="bold" aria-hidden />
				</button>
			</div>
			{packs.length ? (
				<div className="flex gap-2">
					{packs.map((pack) => (
						<button
							key={pack}
							type="button"
							aria-label={`add a pack of ${pack}`}
							disabled={pending || now + pack > pantryQuantityMax}
							onClick={() => onCount(now + pack)}
							className="border-input hover:bg-muted/60 min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-40"
						>
							+{pack}
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}
