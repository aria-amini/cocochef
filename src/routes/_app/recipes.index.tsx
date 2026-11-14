import {
	ArrowRightIcon,
	BookmarkSimpleIcon,
	CheckIcon,
	CheckSquareIcon,
	GlobeHemisphereWestIcon,
	LinkSimpleIcon,
	LockSimpleIcon,
	PencilSimpleLineIcon,
	PlusIcon,
	UserIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
	createContext,
	startTransition,
	useContext,
	useEffect,
	useOptimistic,
	useState,
} from 'react'
import { toast } from 'sonner'

import { useTabBarVisible } from '@/components/app-nav'
import { PendingPage } from '@/components/page-pending'
import { dockActionClassName, FormActions } from '@/components/recipe-form'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { RecipeTileFace, recipeTileClassName } from '@/components/recipe-tile'
import { SaveChip } from '@/components/save-chip'
import { SignUpToKeep } from '@/components/sign-up-to-keep'
import { Button, buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { authClient } from '@/lib/auth/client'
import {
	deleteRecipes,
	listShelf,
	removeSavedRecipe,
	saveRecipe,
} from '@/lib/recipes/server'
import {
	tileColorFor,
	tileColors,
	type TileColor,
} from '@/lib/recipes/tile-color'
import { count } from '@/lib/utils/count'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/recipes/')({
	// The shelf floats its own add button once its add tile scrolls away.
	staticData: { tabBar: 'own-fab' },
	loader: () => listShelf(),
	head: () => ({ meta: [{ title: 'my recipes · cocochef' }] }),
	pendingComponent: ShelfPending,
	component: ShelfPage,
})

const ease = [0.16, 1, 0.3, 1] as const

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

// The recipe shelf's filters: everything, or one kind.
// Four even columns from a tablet up, two on a phone.
const shelfGridClassName =
	'grid grid-cols-2 gap-4 md:auto-rows-[var(--spacing-tile)] md:grid-cols-4'

// Takes recipes off the shelf on screen, until the server's shelf arrives:
// for the chip on a saved recipe's tile, as for clearing many at once.
const ClearOff = createContext<(ids: ReadonlySet<string>) => void>(() => {})

// Each of the shelf's sections opens the same way: its icon, then its name.
const shelfHeadingClassName = 'flex items-center gap-2 text-xl font-bold'

// The shelf on its way: its select button, a section's name, then a grid of
// photo tiles, each a photo over its name.
function ShelfPending() {
	return (
		<PendingPage className="w-full max-w-3xl gap-8 p-6 md:p-10">
			<div className="-mb-4 flex justify-end">
				<Skeleton kind="line" className="h-9 w-24" />
			</div>
			<div className="flex flex-col gap-3">
				<Skeleton kind="line" className="h-7 w-40" />
				<div className={shelfGridClassName}>
					{Array.from({ length: 8 }, (_, i) => (
						<div
							key={i}
							className={recipeTileClassName({
								color: 'cream',
								photo: true,
								className: 'hover:shadow-none',
							})}
						>
							<Skeleton kind="fill" className="min-h-0 flex-1" />
							<div className="border-border flex shrink-0 flex-col gap-1.5 border-t px-2.5 py-2">
								<Skeleton kind="line" className="h-3.5 w-4/5" />
								<Skeleton kind="line" className="h-3 w-1/2" />
							</div>
						</div>
					))}
				</div>
			</div>
		</PendingPage>
	)
}

// Your recipes: the ones you wrote, the ones you saved, and drafts still
// being written, each saying who can see it. Finding new ones is home's job.
// The shelf is kept by an account; signed out, the page says so.
function ShelfPage() {
	const { signedIn } = Route.useLoaderData()

	if (signedIn) return <Shelf />

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-6 p-6 md:p-10">
				<h1 className="sr-only">my recipes</h1>
				<SignUpToKeep
					picture={<ShelfPreview />}
					title="keep your recipes in one place"
					body="sign up to save recipes you find and write your own"
				/>
			</div>
		</main>
	)
}

const previewTiles = [
	{ title: 'tomato soup', color: 'tomato' },
	{ title: 'lemon cake', color: 'yolk' },
	{ title: 'pesto pasta', color: 'basil' },
] as const

// A few blank tiles, for a shelf with nothing on it yet.
function ShelfPreview() {
	return (
		<div aria-hidden className="flex gap-3">
			{previewTiles.map(({ title, color }) => (
				<span
					key={title}
					className={cn(
						'border-border grid size-14 place-items-center rounded-xl border',
						tileColors[color],
					)}
				>
					<RecipeGlyph title={title} size={26} />
				</span>
			))}
		</div>
	)
}

function Shelf() {
	const { recipes: loaded } = Route.useLoaderData()

	// Recipes cleared off leave at once. The shelf the server sends back takes
	// over once it arrives, and brings them back if clearing failed.
	const [shelfRecipes, clearOff] = useOptimistic(
		loaded,
		(recipes, ids: ReadonlySet<string>) =>
			recipes.filter((recipe) => !ids.has(recipe.id)),
	)

	const account = authClient.useSession().data?.user
	const reduce = useReducedMotion()
	const [addTile, tileInView] = useInView()
	const selection = useSelection()

	const enter = reduce
		? {}
		: {
				initial: { opacity: 0, y: 24 },
				animate: { opacity: 1, y: 0 },
				transition: { duration: 0.6, ease },
			}

	const mine = (recipe: Recipe) => !!account && recipe.userId === account.id

	const ownRecipes = shelfRecipes.filter(
		(recipe) => mine(recipe) && recipe.finalizedAt,
	)

	// Recipes still being written, kept apart so they are easy to come back to.
	const drafts = shelfRecipes.filter(
		(recipe) => mine(recipe) && !recipe.finalizedAt,
	)

	const savedRecipes = shelfRecipes.filter((recipe) => !mine(recipe))

	const isEmpty = shelfRecipes.length === 0

	const sections = [
		{ id: 'your-recipes', title: 'your recipes', recipes: ownRecipes },
		{ id: 'saved-recipes', title: 'saved recipes', recipes: savedRecipes },
	]

	// Your own recipes open with the tile to add one, so that shelf shows even
	// before it holds any.
	const ownShelf = 'your-recipes'

	// While choosing, each recipe is a toggle rather than a link.
	const pickFor = (recipe: Recipe) =>
		selection.on
			? {
					selected: selection.has(recipe.id),
					toggle: () => selection.toggle(recipe.id),
				}
			: undefined

	const chosen = shelfRecipes.filter((recipe) => selection.has(recipe.id))

	return (
		<ClearOff value={clearOff}>
			<main className="min-w-0 flex-1">
				<motion.div
					{...enter}
					className="flex w-full max-w-3xl min-w-0 flex-col gap-8 p-6 md:p-10"
				>
					<h1 className="sr-only">my recipes</h1>
					{/* Choosing waits for the account, which tells the cook's own
					    recipes (deleted) from saved ones (only taken off). */}
					{isEmpty || !account ? null : (
						<div className="-mb-4 flex justify-end">
							{selection.on ? (
								<Button
									variant="ghost"
									onClick={() =>
										chosen.length === shelfRecipes.length
											? selection.clear()
											: selection.set(shelfRecipes.map((recipe) => recipe.id))
									}
								>
									{chosen.length === shelfRecipes.length
										? 'select none'
										: 'select all'}
								</Button>
							) : (
								<Button variant="ghost" onClick={selection.start}>
									<CheckSquareIcon aria-hidden />
									select
								</Button>
							)}
						</div>
					)}
					{drafts.length ? <Drafts drafts={drafts} pickFor={pickFor} /> : null}
					{sections.map(({ id, title, recipes }) =>
						recipes.length || id === ownShelf ? (
							<section
								key={id}
								aria-labelledby={id}
								className="flex min-w-0 flex-col gap-3"
							>
								<h2 id={id} className={shelfHeadingClassName}>
									{id === 'saved-recipes' ? (
										<BookmarkSimpleIcon
											size={20}
											weight="fill"
											aria-hidden
											className="text-kitchen-eggplant"
										/>
									) : (
										<UserIcon size={20} weight="bold" aria-hidden />
									)}
									{title}
								</h2>
								<div className={shelfGridClassName}>
									{id === ownShelf && !selection.on ? (
										<AddTile ref={addTile} />
									) : null}
									{recipes.map((recipe) => (
										<RecipeTile
											key={recipe.id}
											recipe={recipe}
											pick={pickFor(recipe)}
											saved={id === 'saved-recipes'}
											color={tileColorFor(recipe.id)}
											seenBy={
												mine(recipe)
													? (recipe.visibility ?? 'private')
													: undefined
											}
										/>
									))}
								</div>
							</section>
						) : null,
					)}
					{/* Last in the column, so it sticks above the tab bar the whole way
				    down and rests under the last recipe. */}
					{selection.on && account ? (
						<SelectionDock
							chosen={chosen}
							mine={mine}
							onClear={clearOff}
							onDone={selection.stop}
							onFailed={(ids) => {
								selection.start()
								selection.set(ids)
							}}
						/>
					) : null}
				</motion.div>
				<AddFab show={!tileInView && !selection.on} />
			</main>
		</ClearOff>
	)
}

// Which recipes are picked, while picking. Escape puts the shelf back.
function useSelection() {
	const [on, setOn] = useState(false)
	const [ids, setIds] = useState<ReadonlySet<string>>(new Set())

	useEffect(() => {
		if (!on) return

		const leave = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOn(false)
		}

		window.addEventListener('keydown', leave)

		return () => window.removeEventListener('keydown', leave)
	}, [on])

	return {
		on,
		has: (id: string) => on && ids.has(id),
		toggle: (id: string) =>
			setIds((current) => {
				const next = new Set(current)

				if (!next.delete(id)) next.add(id)

				return next
			}),
		set: (next: string[]) => setIds(new Set(next)),
		clear: () => setIds(new Set()),
		start: () => {
			setIds(new Set())
			setOn(true)
		},
		stop: () => setOn(false),
	}
}

// What picking does: how many are picked, a way out, and clearing them off
// the shelf after saying what that means for each kind.
function SelectionDock({
	chosen,
	mine,
	onClear,
	onDone,
	onFailed,
}: {
	chosen: Recipe[]
	mine: (recipe: Recipe) => boolean
	// Takes recipes off the shelf on screen, until the server's shelf arrives.
	onClear: (ids: ReadonlySet<string>) => void
	onDone: () => void
	// Picks them again when clearing failed, so trying again is one tap.
	onFailed: (ids: string[]) => void
}) {
	const router = useRouter()
	const [confirming, setConfirming] = useState(false)

	const written = chosen.filter(mine).length
	const saved = chosen.length - written
	// Only saved ones picked: they come off, nothing is lost.
	const removing = written === 0

	// The recipes leave the shelf as soon as the cook confirms; the server
	// catches up behind, and the toast says how it went.
	function remove() {
		const ids = chosen.map((recipe) => recipe.id)
		const done = `${count(ids.length, 'recipe', 'recipes')} off your shelf`
		const failed = `couldn't ${removing ? 'remove' : 'delete'} those — try again`

		setConfirming(false)
		onDone()

		startTransition(async () => {
			onClear(new Set(ids))

			try {
				// The server takes 500 at a time; select all can pick more.
				for (let start = 0; start < ids.length; start += 500)
					await deleteRecipes({ data: { ids: ids.slice(start, start + 500) } })

				toast.success(done)
			} catch {
				toast.error(failed)
				onFailed(ids)
			}

			// The change is made; a failed read only leaves the page as it was.
			await router.invalidate().catch(() => undefined)
		})
	}

	return (
		<>
			<FormActions
				placement="bottom-fab md:pb-bar md:bottom-0"
				status={
					chosen.length ? `${chosen.length} selected` : 'tap recipes to select'
				}
			>
				<button type="button" className={dockActionClassName} onClick={onDone}>
					cancel
				</button>
				<button
					type="button"
					disabled={!chosen.length}
					className={buttonVariants({
						variant: 'destructive',
						className: 'rounded-full px-6',
					})}
					onClick={() => setConfirming(true)}
				>
					{removing && chosen.length ? 'remove' : 'delete'}
				</button>
			</FormActions>
			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>
							{removing ? 'remove' : 'delete'}{' '}
							{count(chosen.length, 'recipe', 'recipes')}?
						</DialogTitle>
						<DialogDescription>
							{removing
								? 'they come off your shelf, along with your notes. they stay up for everyone else, and you can save them again.'
								: saved
									? `the ${count(written, 'recipe', 'recipes')} you wrote ${written === 1 ? 'is' : 'are'} deleted for good, with your notes. the ${saved} you saved just come${saved === 1 ? 's' : ''} off your shelf. there is no undo.`
									: 'this deletes them and your notes for good. there is no undo.'}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirming(false)}>
							keep them
						</Button>
						<Button variant="destructive" onClick={remove}>
							{removing ? 'remove' : 'delete'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

type Pick = { selected: boolean; toggle: () => void } | undefined

// The round mark a picked recipe wears: empty until picked, then a yolk tick.
function PickMark({
	selected,
	className,
}: {
	selected: boolean
	className?: string
}) {
	return (
		<span
			aria-hidden
			className={cn(
				'grid size-7 shrink-0 place-items-center rounded-full border',
				selected
					? 'bg-kitchen-yolk border-foreground'
					: 'bg-card/90 border-foreground/40',
				className,
			)}
		>
			{selected ? <CheckIcon size={14} weight="bold" /> : null}
		</span>
	)
}

// Whether the element given to the returned ref is on screen. True until it
// is measured, and while it is missing, so nothing floats in on first paint.
function useInView() {
	const [element, setElement] = useState<HTMLElement | null>(null)
	const [inView, setInView] = useState(true)

	useEffect(() => {
		if (!element) return

		const observer = new IntersectionObserver(([entry]) =>
			setInView(entry?.isIntersecting ?? true),
		)

		observer.observe(element)

		return () => observer.disconnect()
	}, [element])

	return [setElement, !element || inView] as const
}

// On a phone, the add tile's stand-in once it scrolls away: a round plus over
// the tab bar, in thumb's reach. While the tile
// shows, one way to add is enough.
function AddFab({ show }: { show: boolean }) {
	const tabBar = useTabBarVisible()
	const reduce = useReducedMotion()

	return (
		<AnimatePresence>
			{show && tabBar ? (
				<motion.div
					key="add-fab"
					initial={reduce ? false : { opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={
						reduce
							? { opacity: 0, transition: { duration: 0 } }
							: { opacity: 0, scale: 0.8 }
					}
					transition={{ duration: 0.15, ease }}
					className="bottom-fab fixed right-4 z-20 md:hidden"
				>
					<Link
						to="/recipes/new"
						aria-label="add recipe"
						className="bg-kitchen-yolk grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95"
					>
						<PlusIcon size={26} weight="bold" aria-hidden />
					</Link>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

// Adding a recipe of your own, as the shelf's first tile: dashed, since it
// is not a recipe yet, and the size of one. It opens a blank recipe, which
// also brings one in from a link or pasted text.
function AddTile({ ref }: { ref: React.Ref<HTMLDivElement> }) {
	return (
		<div ref={ref}>
			<Link
				to="/recipes/new"
				className="border-foreground/30 hover:border-foreground/50 text-muted-foreground hover:text-foreground flex aspect-square size-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-bold transition-colors md:aspect-auto"
			>
				<span className="border-foreground/40 grid size-10 place-items-center rounded-full border-2 border-dashed">
					<PlusIcon size={18} weight="bold" aria-hidden />
				</span>
				add a recipe
			</Link>
		</div>
	)
}

// Who can see a recipe of yours, said once on its tile.
const seenByLabels = {
	private: { label: 'only you', icon: LockSimpleIcon },
	unlisted: { label: 'by link', icon: LinkSimpleIcon },
	public: { label: 'public', icon: GlobeHemisphereWestIcon },
} as const

function RecipeTile({
	recipe,
	color,
	seenBy,
	pick,
	saved = false,
}: {
	recipe: Recipe
	color: TileColor
	pick?: Pick
	seenBy?: keyof typeof seenByLabels | undefined
	// Saved from someone else, it can be taken off from its corner.
	saved?: boolean
}) {
	const seen = seenBy ? seenByLabels[seenBy] : undefined

	if (pick)
		return (
			<button
				type="button"
				aria-pressed={pick.selected}
				onClick={pick.toggle}
				className={recipeTileClassName({
					color,
					photo: !!recipe.imageUrl,
					className: cn(
						'w-full cursor-pointer text-left',
						pick.selected && 'border-foreground',
					),
				})}
			>
				<PickMark
					selected={pick.selected}
					className="absolute top-2 left-2 z-10"
				/>
				<RecipeTileFace title={recipe.title} imageUrl={recipe.imageUrl} />
			</button>
		)

	return (
		<div className="relative">
			{saved ? <UnsaveChip recipe={recipe} /> : null}
			<Link
				to="/recipes/$recipeId"
				params={{ recipeId: recipe.id }}
				className={recipeTileClassName({
					color,
					photo: !!recipe.imageUrl,
				})}
			>
				{seen ? (
					<span
						aria-hidden
						title={seen.label}
						className="bg-card/90 border-border absolute top-2 left-2 z-10 grid size-7 place-items-center rounded-md border"
					>
						<seen.icon size={14} weight="bold" aria-hidden />
					</span>
				) : null}
				<RecipeTileFace title={recipe.title} imageUrl={recipe.imageUrl} />
			</Link>
		</div>
	)
}

// Takes a saved recipe off the shelf from its tile, with a moment to take it
// back.
function UnsaveChip({ recipe }: { recipe: Recipe }) {
	const router = useRouter()
	const clearOff = useContext(ClearOff)

	// It leaves the shelf at the tap; the toast and its undo come once the
	// server has it, and a failure puts it back.
	function unsave() {
		startTransition(async () => {
			clearOff(new Set([recipe.id]))

			try {
				await removeSavedRecipe({ data: { id: recipe.id } })
				toast.success('taken off your recipes', {
					position: 'bottom-center',
					action: {
						label: 'undo',
						onClick: () =>
							void saveRecipe({ data: { id: recipe.id } }).then(() =>
								router.invalidate(),
							),
					},
				})
			} catch {
				toast.error("couldn't take it off — try again")
			}

			// The change is made; a failed read only leaves the page as it was.
			await router.invalidate().catch(() => undefined)
		})
	}

	return <SaveChip title={recipe.title} saved saving={false} toggle={unsave} />
}

// What a draft has so far, and what it is still missing.
function progressOf(written: Recipe['written']) {
	if (!written || (!written.ingredients && !written.steps))
		return 'just a name so far'

	return [
		written.ingredients
			? count(written.ingredients, 'ingredient', 'ingredients')
			: 'no ingredients yet',
		written.steps ? count(written.steps, 'step', 'steps') : 'no steps yet',
	].join(' · ')
}

// Recipes still being written, set apart from the finished ones: dashed and
// unfilled, each saying how far it has got, and one tap from carrying on.
function Drafts({
	drafts,
	pickFor,
}: {
	drafts: Recipe[]
	pickFor: (recipe: Recipe) => Pick
}) {
	return (
		<section aria-labelledby="drafts" className="flex min-w-0 flex-col gap-3">
			<h2 id="drafts" className={shelfHeadingClassName}>
				<PencilSimpleLineIcon size={20} weight="bold" aria-hidden />
				drafts
			</h2>
			<ul className="flex flex-col gap-2">
				{drafts.map((recipe) => {
					const pick = pickFor(recipe)

					const about = (
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-base font-bold">
								{recipe.title}
							</span>
							<span className="text-muted-foreground text-sm font-semibold">
								{progressOf(recipe.written)}
							</span>
						</span>
					)

					return (
						<li key={recipe.id}>
							{pick ? (
								<button
									type="button"
									aria-pressed={pick.selected}
									onClick={pick.toggle}
									className={cn(
										'flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors',
										pick.selected
											? 'border-foreground'
											: 'border-input hover:border-foreground/60',
									)}
								>
									<PickMark selected={pick.selected} />
									{about}
								</button>
							) : (
								<Link
									to="/recipes/$recipeId"
									params={{ recipeId: recipe.id }}
									className="border-input hover:border-foreground/60 group flex min-h-16 items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors"
								>
									{about}
									<span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-1.5 text-sm font-bold transition-colors">
										{/* On a phone the arrow alone says it; the row is the link. */}
										<span className="max-sm:sr-only">keep writing</span>
										<ArrowRightIcon size={14} weight="bold" aria-hidden />
									</span>
								</Link>
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}
