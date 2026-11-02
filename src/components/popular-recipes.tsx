import { ArrowRightIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { useRecipeActions } from '@/components/recipe-actions'
import { FieldError } from '@/components/recipe-form'
import { useRecipeImport } from '@/components/recipe-online'
import { Skeleton } from '@/components/ui/skeleton'
import { popularRecipes } from '@/lib/discover/server'
import { cn } from '@/lib/utils/ui'

type Popular = Awaited<ReturnType<typeof popularRecipes>>['results'][number]

const WARM_POLL_MS = 3000

const placeholderCount = 8

export const shelfGridClassName =
	'grid grid-cols-2 gap-4 md:auto-rows-[var(--spacing-tile)] md:grid-cols-[repeat(auto-fill,var(--spacing-tile))]'

export const shelfHeadingClassName =
	'inline-block self-start border-b-3 pb-0.5 text-xs font-semibold'

const tileClassName =
	'border-border bg-card focus-visible:outline-kitchen-eggplant relative flex h-28 min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2'

// What other cooks keep, and recipes from the sites, under your own. Shared
// recipes open at once; a page from a site is brought in when picked, without
// going on the shelf.
export function PopularRecipes() {
	const navigate = useNavigate()
	const { find } = useRecipeActions()

	const { data, isError } = useQuery({
		queryKey: ['popular-recipes'],
		queryFn: () => popularRecipes(),
		// The first visit after a deploy starts the crawl; sites fill in as it runs.
		refetchInterval: (query) =>
			query.state.data?.warming ? WARM_POLL_MS : false,
	})

	const imported = useRecipeImport((recipe) =>
		navigate({ to: '/recipes/$recipeId', params: { recipeId: recipe.id } }),
	)

	// Tiles hold the space while the first results load or the sites warm up.
	const loading = !data || (data.warming && !data.results.length)

	// Popular recipes are extra; when they can't load, the shelf ends cleanly.
	if (isError || (!loading && !data.results.length)) return null

	return (
		<section
			aria-labelledby="popular-recipes"
			aria-busy={loading || undefined}
			className="border-border mt-4 flex w-full max-w-3xl min-w-0 flex-col gap-3 border-t pt-8"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-2">
					<h2
						id="popular-recipes"
						className="text-muted-foreground text-sm font-semibold"
					>
						discover recipes
					</h2>
				</div>
				<button
					type="button"
					onClick={() => find()}
					className="text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant inline-flex min-h-10 items-center gap-2 rounded-md text-xs font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					browse more recipes
					<ArrowRightIcon size={16} weight="bold" aria-hidden />
				</button>
			</div>

			{imported.error ? <FieldError>{imported.error}</FieldError> : null}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*:nth-child(n+3)]:hidden sm:[&>*:nth-child(n+3)]:flex sm:[&>*:nth-child(n+5)]:hidden">
				{loading
					? Array.from({ length: placeholderCount }, (_, index) => (
							<Skeleton key={index} className="h-28" />
						))
					: null}
				{data?.results.map((recipe) =>
					recipe.recipeId ? (
						<Link
							key={recipe.recipeId}
							to="/recipes/$recipeId"
							params={{ recipeId: recipe.recipeId }}
							className={cn(tileClassName)}
						>
							<PopularTileBody recipe={recipe} />
						</Link>
					) : recipe.url ? (
						<button
							key={recipe.url}
							type="button"
							disabled={imported.saving !== undefined}
							onClick={() => recipe.url && void imported.save(recipe.url)}
							className={cn(tileClassName, 'disabled:cursor-default')}
						>
							<PopularTileBody
								recipe={recipe}
								busy={imported.saving === recipe.url}
							/>
						</button>
					) : null,
				)}
			</div>
		</section>
	)
}

function PopularTileBody({
	recipe,
	busy = false,
}: {
	recipe: Popular
	busy?: boolean
}) {
	const [broken, setBroken] = useState(false)
	const pictured = recipe.imageUrl && !broken

	return (
		<>
			{pictured ? (
				<span className="relative block min-h-0 flex-1">
					<img
						src={recipe.imageUrl}
						alt=""
						loading="lazy"
						referrerPolicy="no-referrer"
						onError={() => setBroken(true)}
						className="absolute inset-0 size-full object-cover"
					/>
				</span>
			) : (
				<span className="flex-1" />
			)}
			<span
				className={cn(
					'flex shrink-0 flex-col px-2.5 py-1.5',
					pictured && 'border-border bg-card border-t',
				)}
			>
				<span className="line-clamp-2 text-xs leading-tight font-semibold wrap-anywhere">
					{recipe.title}
				</span>
				<span className="text-muted-foreground truncate text-xs font-semibold">
					{busy ? 'grabbing the page…' : recipe.siteName}
				</span>
			</span>
		</>
	)
}
