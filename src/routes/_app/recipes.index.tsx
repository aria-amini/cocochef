import {
	MagnifyingGlassIcon,
	ArrowRightIcon,
	BookmarkSimpleIcon,
	PencilSimpleLineIcon,
	UserIcon,
	RobotIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useSyncExternalStore } from 'react'

import { AddRecipeMenu } from '@/components/add-recipe-menu'
import {
	PopularRecipes,
	shelfGridClassName,
	shelfHeadingClassName,
} from '@/components/popular-recipes'
import { useRecipeActions } from '@/components/recipe-actions'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { RecipeSources } from '@/components/recipe-sources'
import { Badge } from '@/components/ui/badge'
import { authClient } from '@/lib/auth/client'
import { listShelf } from '@/lib/recipes/server'
import {
	tileColorFor,
	tileColors,
	type TileColor,
} from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/recipes/')({
	// The shelf adds the round add button above the tab bar.
	staticData: { tabBar: 'fab' },
	loader: () => listShelf(),
	component: Shelf,
})

const ease = [0.16, 1, 0.3, 1] as const

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

function Shelf() {
	const { recipes: shelfRecipes } = Route.useLoaderData()
	const account = authClient.useSession().data?.user
	const { find } = useRecipeActions()

	const reduce = useReducedMotion()

	const enter = reduce
		? {}
		: {
				initial: { opacity: 0, y: 24 },
				animate: { opacity: 1, y: 0 },
				transition: { duration: 0.6, ease },
			}

	const ownRecipes = shelfRecipes.filter(
		(recipe) => !!account && recipe.userId === account.id && recipe.finalizedAt,
	)

	// Recipes still being written, kept apart so they are easy to come back to.
	const drafts = shelfRecipes.filter(
		(recipe) =>
			!!account && recipe.userId === account.id && !recipe.finalizedAt,
	)

	const savedRecipes = shelfRecipes.filter(
		(recipe) => !account || recipe.userId !== account.id,
	)

	const isEmpty = shelfRecipes.length === 0

	return (
		<main className="min-w-0 flex-1">
			<motion.div
				{...enter}
				className="flex w-full max-w-3xl min-w-0 flex-col gap-8 p-6 md:p-10"
			>
				<h1 className="sr-only">recipes</h1>
				<div className="flex w-full max-w-3xl flex-wrap items-start gap-3">
					<div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
						<div className="flex gap-2">
							<FinderBox onOpen={() => find()} />
							<AskForIdeas />
						</div>
					</div>
					<div className="hidden items-center gap-3 md:flex">
						{/* Every way to add a recipe of your own. */}
						<AddRecipeMenu
							iconSize={22}
							className="bg-kitchen-yolk grid size-12 shrink-0 place-items-center rounded-full transition-colors hover:brightness-95"
						/>
					</div>
				</div>
				{isEmpty ? (
					<button
						type="button"
						aria-label="save your first recipe: find one, import a link, or write your own"
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
								find one, import a link, or write your own
							</span>
						</span>
					</button>
				) : null}
				{drafts.length ? <Drafts drafts={drafts} /> : null}
				{[
					{ id: 'your-recipes', title: 'your recipes', recipes: ownRecipes },
					{
						id: 'saved-recipes',
						title: 'saved recipes',
						recipes: savedRecipes,
					},
				].map(({ id, title, recipes }) =>
					recipes.length ? (
						<section
							key={id}
							aria-labelledby={id}
							className="flex min-w-0 flex-col gap-3"
						>
							<h2 id={id} className={shelfHeadingClassName}>
								{id === 'your-recipes' ? (
									<UserIcon size={20} weight="bold" aria-hidden />
								) : (
									<BookmarkSimpleIcon
										size={20}
										weight="fill"
										aria-hidden
										className="text-kitchen-eggplant"
									/>
								)}
								{title}
							</h2>
							<div className={shelfGridClassName}>
								{recipes.map((recipe) => (
									<RecipeTile
										key={recipe.id}
										recipe={recipe}
										color={tileColorFor(recipe.id)}
									/>
								))}
							</div>
						</section>
					) : null,
				)}
				<PopularRecipes />
			</motion.div>
		</main>
	)
}

// Where the recipe chat will open, beside the search it complements, with its
// beta chip on the button's top edge. Until the chat lands it is shown but not
// yet usable.
function AskForIdeas() {
	return (
		<button
			type="button"
			disabled
			title="coming soon"
			aria-label="ai: ask for ideas (coming soon)"
			className="border-input bg-card relative inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold"
		>
			<RobotIcon
				size={20}
				weight="duotone"
				aria-hidden
				className="text-kitchen-eggplant"
			/>
			ai
			<Badge size="small" tone="beta" className="absolute -top-2 -right-1.5">
				beta
			</Badge>
		</button>
	)
}

// The one box's front door: it looks like the search it opens.
function FinderBox({ onOpen }: { onOpen: () => void }) {
	const isMac = useSyncExternalStore(
		() => () => undefined,
		() => /Mac|iPhone|iPad/.test(navigator.platform),
		() => true,
	)

	return (
		<button
			type="button"
			onClick={onOpen}
			className="border-input bg-card text-muted-foreground hover:border-foreground/60 flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-base transition-colors"
		>
			<MagnifyingGlassIcon
				size={18}
				weight="bold"
				aria-hidden
				className="text-foreground shrink-0"
			/>
			<span className="min-w-0 truncate">search any recipe</span>
			<RecipeSources className="mr-auto" />
			<kbd
				aria-hidden
				className="border-border hidden shrink-0 rounded-md border px-1.5 text-xs font-semibold md:inline"
			>
				{isMac ? '⌘K' : 'ctrl K'}
			</kbd>
		</button>
	)
}

function RecipeTile({ recipe, color }: { recipe: Recipe; color: TileColor }) {
	return (
		<Link
			to="/recipes/$recipeId"
			params={{ recipeId: recipe.id }}
			className={cn(
				'border-border relative flex aspect-square flex-col overflow-hidden border transition-shadow hover:shadow-md md:aspect-auto rounded-xl',
				recipe.imageUrl ? 'bg-card text-foreground' : tileColors[color],
			)}
		>
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
