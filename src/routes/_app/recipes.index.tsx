import {
	ArrowRight,
	BookmarkSimpleIcon,
	UserIcon,
	MagnifyingGlassIcon,
	PlusIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'framer-motion'

import { ImportLinkButton } from '@/components/import-link'
import {
	PopularRecipes,
	shelfGridClassName,
	shelfHeadingClassName,
} from '@/components/popular-recipes'
import { useRecipeActions } from '@/components/recipe-actions'
import { RecipeGlyph } from '@/components/recipe-glyph'
import { authClient } from '@/lib/auth/client'
import { listShelf } from '@/lib/recipes/server'
import {
	tileColorFor,
	tileColors,
	type TileColor,
} from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/recipes/')({
	loader: () => listShelf(),
	component: Shelf,
})

const ease = [0.16, 1, 0.3, 1] as const

type Recipe = Awaited<ReturnType<typeof listShelf>>['recipes'][number]

function Shelf() {
	const { recipes: shelfRecipes } = Route.useLoaderData()
	const account = authClient.useSession().data?.user
	const { find, importLink } = useRecipeActions()

	const reduce = useReducedMotion()

	const enter = reduce
		? {}
		: {
				initial: { opacity: 0, y: 24 },
				animate: { opacity: 1, y: 0 },
				transition: { duration: 0.6, ease },
			}

	const ownRecipes = shelfRecipes.filter(
		(recipe) => !!account && recipe.userId === account.id,
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
				<div className="flex w-full max-w-3xl flex-wrap items-center gap-3">
					<FinderBox onOpen={() => find()} />
					<div className="hidden items-center gap-3 md:flex">
						<ImportLinkButton onClick={() => importLink()} />
						{/* The page's one solid action: every way to add a recipe. */}
						<button
							type="button"
							aria-label="add recipe"
							onClick={() => find()}
							className="bg-kitchen-basil grid size-12 shrink-0 place-items-center rounded-full transition-colors hover:brightness-95"
						>
							<PlusIcon size={22} weight="bold" aria-hidden />
						</button>
					</div>
				</div>
				{isEmpty ? (
					<button
						type="button"
						onClick={() => find()}
						className="border-foreground/50 bg-kitchen-yolk/25 text-foreground hover:bg-kitchen-yolk/40 relative block aspect-square w-full max-w-md cursor-pointer rounded-xl border border-dashed text-left transition-colors md:aspect-auto md:h-[calc(var(--spacing-tile)*2+16px)] md:w-[calc(var(--spacing-tile)*2+16px)]"
					>
						<span className="bg-kitchen-yolk absolute top-4 right-4 grid size-12 place-items-center rounded-full">
							<ArrowRight weight="bold" className="size-6" aria-hidden />
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
							<h2
								id={id}
								className={cn(
									shelfHeadingClassName,
									'flex items-center gap-1.5',
									id === 'your-recipes'
										? 'border-kitchen-yolk'
										: 'border-saved-blue/60',
								)}
							>
								{id === 'your-recipes' ? (
									<UserIcon size={15} weight="bold" aria-hidden />
								) : (
									<BookmarkSimpleIcon
										size={15}
										weight="fill"
										aria-hidden
										className="text-saved-blue"
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

// The one box's front door: it looks like the search it opens.
function FinderBox({ onOpen }: { onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			className="border-input bg-card text-muted-foreground hover:border-foreground/60 flex max-w-xl min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-base transition-colors"
		>
			<MagnifyingGlassIcon
				size={18}
				weight="bold"
				aria-hidden
				className="text-foreground shrink-0"
			/>
			<span className="min-w-0 flex-1 truncate">
				find a recipe to cook or start from
			</span>
			<kbd
				aria-hidden
				className="border-border hidden shrink-0 rounded border px-1.5 text-xs font-semibold md:inline"
			>
				⌘K
			</kbd>
		</button>
	)
}

// A draft is still being written: drawn dashed on cream, like anything else
// not yet real, until it is finished.
function RecipeTile({ recipe, color }: { recipe: Recipe; color: TileColor }) {
	const draft = !recipe.finalizedAt

	return (
		<Link
			to="/recipes/$recipeId"
			params={{ recipeId: recipe.id }}
			className={cn(
				'border-border relative flex aspect-square flex-col overflow-hidden border transition-shadow hover:shadow-md md:aspect-auto rounded-xl',
				draft
					? 'border-input bg-card border-dashed'
					: recipe.imageUrl
						? 'bg-card text-foreground'
						: tileColors[color],
			)}
		>
			{draft ? (
				<span className="text-muted-foreground absolute top-2.5 left-3 z-10 text-xs font-semibold">
					draft
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
					{/* Long names stop short of the draft label rather than run under it. */}
					<h3
						className={cn(
							'absolute right-3 bottom-2.5 left-3 text-xl leading-tight font-bold wrap-anywhere',
							draft ? 'line-clamp-3' : 'line-clamp-4',
						)}
					>
						{recipe.title}
					</h3>
				</>
			)}
		</Link>
	)
}
