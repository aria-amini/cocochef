import {
	ArrowRightIcon,
	BookmarkSimpleIcon,
	GlobeHemisphereWestIcon,
	LinkSimpleIcon,
	LockSimpleIcon,
	PencilSimpleLineIcon,
	PlusIcon,
	UserIcon,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { toast } from 'sonner'

import { AddRecipeMenu } from '@/components/add-recipe-menu'
import { useRecipeActions } from '@/components/recipe-actions'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { SaveChip } from '@/components/save-chip'
import { authClient } from '@/lib/auth/client'
import { listShelf, removeSavedRecipe, saveRecipe } from '@/lib/recipes/server'
import {
	tileColorFor,
	tileColors,
	type TileColor,
} from '@/lib/recipes/tile-color'
import { getMySharingProfile } from '@/lib/sharing/server'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/recipes/')({
	// The shelf adds the round add button above the tab bar.
	staticData: { tabBar: 'fab' },
	loader: () => listShelf(),
	component: Shelf,
})

const ease = [0.16, 1, 0.3, 1] as const

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

// The recipe shelf's filters: everything, or one kind.
// Four even columns from a tablet up, two on a phone.
const shelfGridClassName =
	'grid grid-cols-2 gap-4 md:auto-rows-[var(--spacing-tile)] md:grid-cols-4'

// Each of the shelf's sections opens the same way: its icon, then its name.
const shelfHeadingClassName = 'flex items-center gap-2 text-xl font-bold'

const shelfFilters = ['all', 'written', 'saved', 'drafts', 'shared'] as const

type ShelfFilter = (typeof shelfFilters)[number]

// Your recipes: the ones you wrote, the ones you saved, and drafts still
// being written, each saying who can see it. Finding new ones is home's job.
function Shelf() {
	const { recipes: shelfRecipes } = Route.useLoaderData()
	const account = authClient.useSession().data?.user
	const { find } = useRecipeActions()
	const [picked, setFilter] = useState<ShelfFilter>('all')

	const reduce = useReducedMotion()

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

	// What others can see: on your profile, or by its link.
	const shared = ownRecipes.filter(
		(recipe) => recipe.visibility && recipe.visibility !== 'private',
	)

	const counts: Record<ShelfFilter, number> = {
		all: shelfRecipes.length,
		written: ownRecipes.length,
		saved: savedRecipes.length,
		drafts: drafts.length,
		shared: shared.length,
	}

	// A filter whose last recipe goes (an unsave) falls back to everything.
	const filter = picked === 'all' || counts[picked] ? picked : 'all'

	const isEmpty = shelfRecipes.length === 0

	const sections =
		filter === 'all'
			? [
					{ id: 'your-recipes', title: 'your recipes', recipes: ownRecipes },
					{
						id: 'saved-recipes',
						title: 'saved recipes',
						recipes: savedRecipes,
					},
				]
			: filter === 'written'
				? [{ id: 'your-recipes', title: 'your recipes', recipes: ownRecipes }]
				: filter === 'saved'
					? [
							{
								id: 'saved-recipes',
								title: 'saved recipes',
								recipes: savedRecipes,
							},
						]
					: filter === 'shared'
						? [{ id: 'shared-recipes', title: 'shared', recipes: shared }]
						: []

	// The first shelf shown opens with the tile to add a recipe of your own.
	const firstSection = sections.find((section) => section.recipes.length)?.id

	return (
		<main className="min-w-0 flex-1">
			<motion.div
				{...enter}
				className="flex w-full max-w-3xl min-w-0 flex-col gap-8 p-6 md:p-10"
			>
				<h1 className="sr-only">my recipes</h1>
				<div className="flex w-full flex-wrap items-center justify-between gap-3">
					<SharedFrom signedIn={!!account} />
				</div>
				{isEmpty ? (
					<button
						type="button"
						aria-label="save your first recipe: find one, paste a link, or name your own"
						onClick={() => find()}
						className="border-foreground/50 bg-kitchen-yolk/25 text-foreground hover:bg-kitchen-yolk/40 relative block h-44 w-full max-w-md cursor-pointer rounded-xl border border-dashed text-left transition-colors md:h-[calc(var(--spacing-tile)*2+16px)] md:w-[calc(var(--spacing-tile)*2+16px)]"
					>
						{/* Outlined, so it reads as clickable without a second solid. */}
						<span className="border-foreground/50 absolute top-4 right-4 grid size-10 place-items-center rounded-full border">
							<ArrowRightIcon size={20} weight="bold" aria-hidden />
						</span>
						<span className="absolute right-4 bottom-4 left-4 flex flex-col gap-2">
							<span className="text-3xl leading-none font-bold md:text-4xl">
								save your first recipe
							</span>
							<span className="text-foreground/70 text-sm font-semibold">
								find one, paste a link, or name your own
							</span>
						</span>
					</button>
				) : (
					<nav
						aria-label="show"
						className="-mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:flex-wrap md:px-0"
					>
						{shelfFilters.flatMap((option) =>
							option !== 'all' && !counts[option]
								? []
								: [
										<button
											key={option}
											type="button"
											aria-pressed={filter === option}
											onClick={() => setFilter(option)}
											className={cn(
												'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
												filter === option
													? 'bg-kitchen-yolk/45 border-transparent'
													: 'border-input hover:bg-muted/60',
											)}
										>
											{option}
											<span className="text-muted-foreground tabular-nums">
												{counts[option]}
											</span>
										</button>,
									],
						)}
					</nav>
				)}
				{(filter === 'all' || filter === 'drafts') && drafts.length ? (
					<Drafts drafts={drafts} />
				) : null}
				{sections.map(({ id, title, recipes }) =>
					recipes.length ? (
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
								) : id === 'shared-recipes' ? (
									<GlobeHemisphereWestIcon
										size={20}
										weight="bold"
										aria-hidden
									/>
								) : (
									<UserIcon size={20} weight="bold" aria-hidden />
								)}
								{title}
							</h2>
							<div className={shelfGridClassName}>
								{id === firstSection ? <AddTile /> : null}
								{recipes.map((recipe) => (
									<RecipeTile
										key={recipe.id}
										recipe={recipe}
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
			</motion.div>
		</main>
	)
}

// Adding a recipe of your own, as the shelf's first tile: dashed, since it
// is not a recipe yet, and the size of one. It opens every way to add: write
// one, import a link, or paste its text. On a phone the round plus over the
// tab bar does this, in thumb's reach, so the tile is for wider screens.
function AddTile() {
	return (
		<div className="hidden md:block">
			<AddRecipeMenu
				align="start"
				className="border-foreground/30 hover:border-foreground/50 text-muted-foreground hover:text-foreground data-popup-open:border-foreground/50 data-popup-open:text-foreground flex size-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-bold transition-colors"
			>
				<span className="border-foreground/40 grid size-10 place-items-center rounded-full border-2 border-dashed">
					<PlusIcon size={18} weight="bold" aria-hidden />
				</span>
				add a recipe
			</AddRecipeMenu>
		</div>
	)
}

// Where your shared recipes can be seen: your profile, or a way to make one.
function SharedFrom({ signedIn }: { signedIn: boolean }) {
	const profile = useQuery({
		queryKey: ['sharing-profile', 'shelf'],
		queryFn: () => getMySharingProfile(),
		enabled: signedIn,
	})

	if (!signedIn || profile.isPending) return <span />

	return profile.data ? (
		<Link
			to="/$handle"
			params={{ handle: profile.data.handle }}
			className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm font-bold transition-colors"
		>
			<GlobeHemisphereWestIcon size={16} weight="bold" aria-hidden />
			your profile · @{profile.data.handle}
			<ArrowRightIcon size={14} weight="bold" aria-hidden />
		</Link>
	) : (
		<Link
			to="/settings"
			hash="public-profile"
			className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 text-sm font-bold underline underline-offset-4 transition-colors"
		>
			make a profile to share recipes
		</Link>
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
	saved = false,
}: {
	recipe: Recipe
	color: TileColor
	seenBy?: keyof typeof seenByLabels | undefined
	// Saved from someone else, it can be taken off from its corner.
	saved?: boolean
}) {
	const seen = seenBy ? seenByLabels[seenBy] : undefined

	return (
		<div className="relative">
			{saved ? <UnsaveChip recipe={recipe} /> : null}
			<Link
				to="/recipes/$recipeId"
				params={{ recipeId: recipe.id }}
				className={cn(
					'border-border relative flex aspect-square flex-col overflow-hidden border transition-shadow hover:shadow-md md:aspect-auto md:h-full rounded-xl',
					recipe.imageUrl ? 'bg-card text-foreground' : tileColors[color],
				)}
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
				{recipe.imageUrl ? (
					<>
						<div className="relative min-h-0 flex-1">
							<img
								src={recipe.imageUrl}
								alt=""
								loading="lazy"
								className="absolute inset-0 size-full object-cover"
							/>
						</div>
						<h3 className="border-border bg-card line-clamp-2 shrink-0 border-t px-2.5 py-1.5 text-sm leading-tight font-bold wrap-anywhere">
							{recipe.title}
						</h3>
					</>
				) : (
					<>
						<RecipeGlyph
							title={recipe.title}
							size={40}
							className="text-foreground/60 absolute top-3 right-3"
						/>
						<h3 className="absolute right-3 bottom-2.5 left-3 line-clamp-4 text-xl leading-tight font-bold wrap-anywhere">
							{recipe.title}
						</h3>
					</>
				)}
			</Link>
		</div>
	)
}

// Takes a saved recipe off the shelf from its tile, with a moment to take it
// back.
function UnsaveChip({ recipe }: { recipe: Recipe }) {
	const router = useRouter()
	const [saving, setSaving] = useState(false)

	async function unsave() {
		setSaving(true)

		try {
			await removeSavedRecipe({ data: { id: recipe.id } })
			await router.invalidate()
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
		} finally {
			setSaving(false)
		}
	}

	return (
		<SaveChip
			title={recipe.title}
			saved
			saving={saving}
			toggle={() => void unsave()}
		/>
	)
}

const count = (total: number, one: string, many: string) =>
	`${total} ${total === 1 ? one : many}`

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
function Drafts({ drafts }: { drafts: Recipe[] }) {
	return (
		<section aria-labelledby="drafts" className="flex min-w-0 flex-col gap-3">
			<h2 id="drafts" className={shelfHeadingClassName}>
				<PencilSimpleLineIcon size={20} weight="bold" aria-hidden />
				drafts
			</h2>
			<ul className="flex flex-col gap-2">
				{drafts.map((recipe) => (
					<li key={recipe.id}>
						<Link
							to="/recipes/$recipeId"
							params={{ recipeId: recipe.id }}
							className="border-input hover:border-foreground/60 group flex min-h-16 items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors"
						>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-base font-bold">
									{recipe.title}
								</span>
								<span className="text-muted-foreground text-sm font-semibold">
									{progressOf(recipe.written)}
								</span>
							</span>
							<span className="text-muted-foreground group-hover:text-foreground flex shrink-0 items-center gap-1.5 text-sm font-bold transition-colors">
								{/* On a phone the arrow alone says it; the row is the link. */}
								<span className="max-sm:sr-only">keep writing</span>
								<ArrowRightIcon size={14} weight="bold" aria-hidden />
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
