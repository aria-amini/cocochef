import {
	CaretDownIcon,
	DropIcon,
	GrainsIcon,
	JarIcon,
	PackageIcon,
	PepperIcon,
	ThermometerColdIcon,
	type Icon,
	MagnifyingGlass,
	Plus,
	SnowflakeIcon,
	X,
} from '@phosphor-icons/react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect, useOptimistic, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { FoodPicture } from '@/components/food-picture'
import { ItemSheet } from '@/components/item-sheet'
import { DetailPanel } from '@/components/kitchen-page'
import { BackLink } from '@/components/page'
import { PantrySprite } from '@/components/pantry-sprite'
import { buttonVariants } from '@/components/ui/button'
import { undoToast } from '@/components/undo-toast'
import { useWaitingGroceries } from '@/components/use-pantry'
import {
	catalogSections,
	categorizeIngredient,
	filterCatalogItems,
	normalizeIngredientName,
} from '@/lib/pantry/catalog'
import { findInPantry } from '@/lib/pantry/foods'
import {
	kindOf,
	kindOrder,
	pantryPlaces,
	pantryShelves,
	shelfOfItem,
	type PantryShelf,
} from '@/lib/pantry/kinds'
import type { PantryCategory } from '@/lib/pantry/model'
import {
	createPantryItems,
	deletePantryItem,
	listPantry,
	restorePantryItem,
} from '@/lib/pantry/server'
import { resolveSpriteLook } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/pantry/staples')({
	// The shelf a link opens on, by its id.
	validateSearch: z.object({
		shelf: z.string().optional().catch(undefined),
		// Opened to add a food: the search box takes it.
		find: z.boolean().optional().catch(undefined),
	}),
	// Signed out, there is no pantry: its page says how to get one.
	loader: async () => {
		const items = await listPantry()

		if (!items) throw redirect({ to: '/pantry' })

		return items
	},
	head: () => ({ meta: [{ title: 'all your food · cocochef' }] }),
	component: Shelves,
})

type Item = NonNullable<Awaited<ReturnType<typeof listPantry>>>[number]

// A food the catalog knows that isn't kept: shown dashed, to add.
type Suggestion = { name: string; category: PantryCategory }

// How many dashed foods a shelf shows before "more": fewer once the cook
// keeps some there, more on a bare shelf, where they're how to start.
const peekKept = 6

const peekBare = 12

// What most fridges hold, offered without a search.
const fridgeUsuals = [
	'eggs',
	'milk',
	'butter',
	'yogurt',
	'cheddar',
	'chicken breast',
	'onions',
	'garlic',
	'lemons',
	'carrots',
]

// The kitchen's shelves: what's kept, solid, and what the catalog offers,
// dashed. A solid food opens what's low or out about it; a dashed one is
// added at a tap. Editing takes food off.
function Shelves() {
	const router = useRouter()
	const loaded = Route.useLoaderData()
	const { shelf: opened, find } = Route.useSearch()
	const [query, setQuery] = useState('')
	const [editing, setEditing] = useState(false)

	// Shelves whose whole catalog shows, the one a link opened among them.
	// Shelves opened to their food, all closed but the one a link named,
	// since the pantry page already shows what's fresh; and shelves showing
	// all the catalog offers.
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(opened ? [opened] : []),
	)

	const [full, setFull] = useState<ReadonlySet<string>>(
		() => new Set(opened ? [opened] : []),
	)

	useEffect(() => {
		if (opened)
			document
				.getElementById(`shelf-${opened}`)
				?.scrollIntoView({ block: 'start' })
	}, [opened])

	const [shown, change] = useOptimistic(
		loaded,
		(now, next: Partial<Item> & { id: string }) =>
			now.map((item) => (item.id === next.id ? { ...item, ...next } : item)),
	)

	// Removed at once, and back only once undo says so.
	const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
	// Added at a tap, solid before the server has it.
	const [adding, setAdding] = useState<readonly Suggestion[]>([])

	const kept = shown.filter((item) => !item.expired && !hidden.has(item.id))

	const keptNames = new Set([
		...kept.map((item) => normalizeIngredientName(item.name)),
		...adding.map((food) => food.name),
	])

	const suggestions = [
		...new Map(
			catalogSections.flatMap((section) =>
				section.items.map(
					(name) => [name, { name, category: section.id }] as const,
				),
			),
		).values(),
	].filter((food) => !keptNames.has(food.name))

	const typed = normalizeIngredientName(query)

	const matches = <Food extends { name: string }>(foods: Food[]) => {
		if (!query) return foods

		const names = new Set(
			filterCatalogItems(
				foods.map((food) => food.name),
				query,
			),
		)

		return foods.filter((food) => names.has(food.name))
	}

	const canAddTyped =
		typed.length > 0 &&
		typed.length <= 80 &&
		!keptNames.has(typed) &&
		!suggestions.some((food) => food.name === typed)

	const waiting = useWaitingGroceries(true).data ?? []

	const lineOf = (item: Item) =>
		waiting.find((line) => findInPantry(line.text, [item]))

	// The food whose sheet is open, read live so a level changed in it shows.
	const [askedId, setAskedId] = useState<string>()
	const asked = shown.find((item) => item.id === askedId)

	// Kept at a tap; undo takes it back off.
	async function keep(food: Suggestion) {
		setAdding((now) => [...now, food])

		const settle = () =>
			setAdding((now) => now.filter((each) => each.name !== food.name))

		try {
			const [made] = await createPantryItems({ data: [food] })
			await router.invalidate()
			settle()

			if (made)
				undoToast(`added ${food.name}`, () => {
					deletePantryItem({ data: { id: made.id } })
						.then(() => router.invalidate())
						.catch(() =>
							toast.error(`couldn't take ${food.name} off — try again`),
						)
				})
		} catch {
			settle()
			toast.error(`couldn't add ${food.name} — try again`)
		}
	}

	function keepTyped() {
		void keep({ name: typed, category: categorizeIngredient(typed) })
		setQuery('')
	}

	function show(id: string, on: boolean) {
		setHidden((now) => {
			const next = new Set(now)

			if (on) next.delete(id)
			else next.add(id)

			return next
		})
	}

	function remove(item: Item) {
		show(item.id, false)

		// The deletion alone, so undo still runs if only the refresh fails.
		const removed = deletePantryItem({ data: { id: item.id } })

		removed.then(
			() => router.invalidate(),
			() => {
				show(item.id, true)
				toast.error(`couldn't remove ${item.name} — try again`)
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

	return (
		// Its own rows only: the pantry tab, kept alive and hidden, has rows with
		// the same marks.
		<main data-staples className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 pb-28 md:p-10 md:pb-28">
				<div className="flex flex-col gap-1">
					<BackLink to="/pantry">pantry</BackLink>
					<div className="flex min-h-11 items-center gap-3">
						{/* Named as the pantry and the list are: plainly, in a line. */}
						<h1 className="flex-1 text-lg font-bold">all your food</h1>
						<button
							type="button"
							aria-pressed={editing}
							onClick={() => setEditing((now) => !now)}
							className={buttonVariants({
								variant: 'ghost',
								className: 'min-h-11 px-3',
							})}
						>
							{editing ? 'done' : 'edit'}
						</button>
					</div>
					{/* Editing changes what a tap does, so it says so. */}
					{editing ? (
						<p className="text-muted-foreground text-sm">
							tap what you no longer keep
						</p>
					) : null}
				</div>

				<label className="bg-card border-input focus-within:border-foreground/40 flex min-h-11 items-center gap-2 rounded-md border px-3 transition-colors">
					<MagnifyingGlass
						size={18}
						weight="bold"
						aria-hidden
						className="text-muted-foreground shrink-0"
					/>
					<span className="sr-only">find or add a food</span>
					<input
						type="search"
						value={query}
						autoComplete="off"
						maxLength={80}
						placeholder="find or add a food"
						// The page was opened to type a food in.
						// oxlint-disable-next-line jsx-a11y/no-autofocus
						autoFocus={find}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key !== 'Enter' || !canAddTyped) return
							event.preventDefault()
							keepTyped()
						}}
						className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
					/>
				</label>

				{pantryPlaces.map((place) => {
					const shelves = pantryShelves.filter((shelf) => shelf.place === place)

					const drawn = shelves.flatMap((shelf) => {
						const mine = matches(onShelf(kept, shelf))
						const pending = matches(onShelf([...adding], shelf))

						// Fresh food comes from the grocery list, and there's too
						// much of it to browse: the fridge offers only what most
						// fridges hold, and the rest to a search.
						const offered = editing
							? []
							: shelf.id === 'fridge' && !query
								? fridgeUsuals.flatMap(
										(name) =>
											suggestions.find((food) => food.name === name) ?? [],
									)
								: matches(onShelf(suggestions, shelf, false))

						const searching = query !== ''
						const whole = searching || full.has(shelf.id)

						const offeredShown = whole
							? offered
							: offered.slice(0, mine.length ? peekKept : peekBare)

						// Searching, only shelves with a match show; otherwise a bare
						// shelf still shows if it has food to offer, as a place to add to.
						const held = mine.length > 0 || pending.length > 0

						if (!held && !offered.length) return []

						const isOpen = searching || expanded.has(shelf.id)
						const short = mine.filter((item) => item.level !== 'plenty')
						const outs = short.filter((item) => item.level === 'out').length

						return [
							<section
								key={shelf.id}
								id={`shelf-${shelf.id}`}
								aria-label={shelf.label}
								className="bg-card border-border scroll-mt-4 overflow-hidden rounded-xl border"
							>
								<button
									type="button"
									aria-expanded={isOpen}
									disabled={searching}
									onClick={() =>
										setExpanded((now) => {
											const next = new Set(now)

											if (next.has(shelf.id)) next.delete(shelf.id)
											else next.add(shelf.id)

											return next
										})
									}
									className="hover:bg-muted/40 flex min-h-13 w-full items-center gap-3 px-4 text-left transition-colors disabled:hover:bg-transparent"
								>
									<ShelfIcon
										shelf={shelf.id}
										className={cn('shrink-0', !held && 'text-muted-foreground')}
									/>
									{/* A bare shelf is quieter: nothing kept there yet. */}
									<span
										className={cn(
											'min-w-0 flex-1 text-base font-bold',
											!held && 'text-muted-foreground',
										)}
									>
										{shelf.label}
									</span>
									{short.length && !isOpen ? (
										<span
											className={cn(
												'shrink-0 rounded-md px-1.5 text-xs leading-5 font-bold',
												outs ? 'bg-kitchen-tomato/15' : 'bg-kitchen-yolk/25',
											)}
										>
											{outs ? `${outs} out` : `${short.length} low`}
										</span>
									) : null}
									{searching ? null : (
										<CaretDownIcon
											size={14}
											weight="bold"
											aria-hidden
											className={cn(
												'text-muted-foreground shrink-0 transition-transform',
												isOpen && 'rotate-180',
											)}
										/>
									)}
								</button>
								{isOpen ? (
									<div className="flex flex-col gap-2 px-3 pb-3">
										{mine.length || pending.length ? (
											<ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
												{mine.map((item) => (
													<KeptTile
														key={item.id}
														item={item}
														editing={editing}
														listed={!!lineOf(item)}
														onTap={() =>
															editing ? remove(item) : setAskedId(item.id)
														}
													/>
												))}
												{pending.map((food) => (
													<AddedTile key={food.name} food={food} />
												))}
											</ul>
										) : null}
										{offeredShown.length ? (
											<ul
												aria-label={`more ${shelf.label} to add`}
												className="flex flex-wrap gap-1.5"
											>
												{offeredShown.map((food) => (
													<li key={food.name}>
														<button
															type="button"
															aria-label={`add ${food.name}`}
															onClick={() => void keep(food)}
															className="border-foreground/30 text-muted-foreground hover:text-foreground hover:border-input flex min-h-10 items-center gap-1 rounded-md border border-dashed px-2.5 text-sm font-semibold transition-colors"
														>
															<Plus size={12} weight="bold" aria-hidden />
															{food.name}
														</button>
													</li>
												))}
												{!whole && offered.length > offeredShown.length ? (
													<li>
														<button
															type="button"
															onClick={() =>
																setFull((now) => new Set(now).add(shelf.id))
															}
															className="text-muted-foreground hover:text-foreground flex min-h-10 items-center gap-1 px-1.5 text-sm font-semibold transition-colors"
														>
															more
															<CaretDownIcon
																size={12}
																weight="bold"
																aria-hidden
															/>
														</button>
													</li>
												) : null}
											</ul>
										) : null}
									</div>
								) : null}
							</section>,
						]
					})

					if (!drawn.length) return null

					// Each place's shelves sit under its name.
					return (
						<section
							key={place}
							aria-label={place}
							className="flex flex-col gap-2"
						>
							<h2 className="text-muted-foreground mt-2 text-sm font-bold first:mt-0">
								{place}
							</h2>
							{drawn}
						</section>
					)
				})}

				{/* The catalog's own matches first; what was typed, last. */}
				{canAddTyped ? (
					<button
						type="button"
						onClick={keepTyped}
						className="border-foreground/40 hover:border-input flex min-h-12 items-center gap-2 rounded-md border border-dashed px-3 text-left text-sm font-semibold"
					>
						<Plus size={16} weight="bold" aria-hidden />
						add &ldquo;{typed}&rdquo;
					</button>
				) : null}
			</div>
			{/* The same sheet the pantry opens, under the tile on a wide screen
			    and from the bottom on a phone. */}
			{asked ? (
				<ItemSheet
					anchor={() =>
						document.querySelector(`[data-staples] [data-pantry="${asked.id}"]`)
					}
					title={asked.name}
					initialFocus={() =>
						document.querySelector<HTMLElement>('[data-sheet-done]')
					}
					onClose={() => setAskedId(undefined)}
				>
					<DetailPanel
						key={asked.id}
						item={asked}
						line={lineOf(asked)}
						onPatch={(fields) => change({ id: asked.id, ...fields })}
						onRemove={() => {
							setAskedId(undefined)
							remove(asked)
						}}
					/>
				</ItemSheet>
			) : null}
		</main>
	)
}

// A shelf's share of some food, kind by kind: kept food by name, offered
// food in the catalog's own order, commonest first.
function onShelf<
	Food extends {
		name: string
		category: PantryCategory
		frozenAt?: Date | null
	},
>(foods: Food[], shelf: PantryShelf, byName = true) {
	const rank = (food: Food) =>
		kindOrder.get(kindOf(food.name, food.category)) ?? 0

	return foods
		.filter((food) => shelfOfItem(food).id === shelf.id)
		.sort(
			(a, b) =>
				rank(a) - rank(b) || (byName ? a.name.localeCompare(b.name) : 0),
		)
}

// Each shelf's mark, drawn as the tabs' are.
const shelfIcons: Record<PantryShelf['id'], Icon> = {
	fridge: ThermometerColdIcon,
	freezer: SnowflakeIcon,
	sauces: DropIcon,
	dry: GrainsIcon,
	cans: JarIcon,
	spices: PepperIcon,
	other: PackageIcon,
}

function ShelfIcon({
	shelf,
	className,
}: {
	shelf: PantryShelf['id']
	className?: string
}) {
	const Mark = shelfIcons[shelf]

	return <Mark size={20} weight="bold" aria-hidden className={className} />
}

const tileClassName =
	'flex h-full min-h-14 w-full items-center gap-2 rounded-md border p-2 text-left text-sm font-semibold transition-colors'

// A kept food: solid, with what's short and whether it's listed under its
// name. Editing, a cross says a tap takes it off.
function KeptTile({
	item,
	editing,
	listed,
	onTap,
}: {
	item: Item
	editing: boolean
	listed: boolean
	onTap: () => void
}) {
	const out = item.level === 'out'
	const low = item.level === 'low'
	const status = `${out ? 'out' : low ? 'running low' : 'have it'}${listed ? ', on your list' : ''}`

	return (
		<li>
			<button
				type="button"
				data-pantry={item.id}
				aria-label={editing ? `remove ${item.name}` : `${item.name}, ${status}`}
				onClick={onTap}
				className={cn(tileClassName, 'border-border bg-card hover:bg-muted/40')}
			>
				<FoodPicture
					food={item.name}
					brand={item.brand}
					look={resolveSpriteLook(item.name, item.spriteKey, item.category)}
					className="size-9 shrink-0 [image-rendering:pixelated]"
				/>
				<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 leading-tight">
					<span className="line-clamp-2 max-w-full break-words">
						{item.name}
					</span>
					{out || low || listed || item.brand ? (
						<span className="flex max-w-full min-w-0 items-center gap-1.5">
							{item.brand ? (
								<span className="text-muted-foreground truncate text-xs font-semibold">
									{item.brand}
								</span>
							) : null}
							{out || low ? (
								<span
									className={cn(
										'rounded-md px-1.5 text-xs leading-5 font-bold',
										out ? 'bg-kitchen-tomato/15' : 'bg-kitchen-yolk/25',
									)}
								>
									{out ? 'out' : 'low'}
								</span>
							) : null}
							{listed ? (
								<span className="text-muted-foreground text-xs font-semibold">
									on list
								</span>
							) : null}
						</span>
					) : null}
				</span>
				{item.frozenAt ? (
					<SnowflakeIcon
						size={14}
						weight="bold"
						aria-hidden
						className="text-muted-foreground shrink-0"
					/>
				) : null}
				{editing ? (
					<X
						size={16}
						weight="bold"
						aria-hidden
						className="text-muted-foreground shrink-0"
					/>
				) : null}
			</button>
		</li>
	)
}

// A food just kept: solid while the server catches up.
function AddedTile({ food }: { food: Suggestion }) {
	return (
		<li>
			<span
				aria-label={`${food.name}, added`}
				className={cn(tileClassName, 'border-border bg-card')}
			>
				<PantrySprite
					look={resolveSpriteLook(food.name, null, food.category)}
					className="size-9 shrink-0 [image-rendering:pixelated]"
				/>
				<span className="line-clamp-2 min-w-0 flex-1 leading-tight break-words">
					{food.name}
				</span>
			</span>
		</li>
	)
}
