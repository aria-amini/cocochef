import { GlobeHemisphereWestIcon, CookingPotIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { FieldError } from '@/components/recipe-form'
import { useRecipeImport } from '@/components/recipe-online'
import { SiteIcon } from '@/components/site-icon'
import { Skeleton } from '@/components/ui/skeleton'
import { popularRecipes } from '@/lib/discover/server'
import { cn } from '@/lib/utils/ui'

type Popular = Awaited<ReturnType<typeof popularRecipes>>['results'][number]

const WARM_POLL_MS = 3000

// One row of the shelf's columns: four recipes, or two on a phone. The finder
// holds the longer list.
const shownCount = 4

// Four even columns from a tablet up, two on a phone, so the shelf and
// discovery fill the page edge to edge in the same columns.
const tileColumnsClassName = 'grid grid-cols-2 gap-4 md:grid-cols-4'

export const shelfGridClassName = cn(
	tileColumnsClassName,
	'md:auto-rows-[var(--spacing-tile)]',
)

// Each of the shelf's sections opens the same way: its icon, then its name.
export const shelfHeadingClassName = 'flex items-center gap-2 text-xl font-bold'

const tileClassName =
	'border-border bg-card relative flex h-28 min-w-0 flex-col overflow-hidden rounded-xl border text-left transition-colors hover:border-foreground/40 '

// What other cooks keep, and recipes from the sites, under your own. Shared
// recipes open at once; a page from a site is brought in when picked, without
// going on the shelf.
export function PopularRecipes() {
	const navigate = useNavigate()

	const { data, isError } = useQuery({
		queryKey: ['popular-recipes'],
		queryFn: () => popularRecipes(),
		// The first visit after a deploy starts the crawl; sites fill in as it runs.
		refetchInterval: (query) =>
			query.state.data?.warming ? WARM_POLL_MS : false,
	})

	// Sort is stable, so pictured recipes lead and each group keeps its order.
	const tiles = [...(data?.results ?? [])]
		.sort((a, b) => Number(!a.imageUrl) - Number(!b.imageUrl))
		.slice(0, shownCount)

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
			<h2 id="popular-recipes" className={shelfHeadingClassName}>
				<GlobeHemisphereWestIcon size={20} weight="bold" aria-hidden />
				discover recipes
			</h2>

			{imported.error ? <FieldError>{imported.error}</FieldError> : null}
			<div
				className={cn(
					tileColumnsClassName,
					'[&>*:nth-child(n+3)]:hidden md:[&>*:nth-child(n+3)]:flex md:[&>*:nth-child(n+5)]:hidden',
				)}
			>
				{loading
					? Array.from({ length: shownCount }, (_, index) => (
							<Skeleton key={index} className="h-28" />
						))
					: null}
				{tiles.map((recipe) =>
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
				// Stands in for a site that gave no photo, so a tile never opens on a
				// blank. A plain pot, since a picked ingredient could be one the
				// recipe doesn't use.
				<span
					data-placeholder
					className="bg-card text-foreground/35 grid min-h-0 flex-1 place-items-center"
				>
					<CookingPotIcon size={32} aria-hidden />
				</span>
			)}
			<span className="border-border bg-card flex shrink-0 flex-col border-t px-2.5 py-1.5">
				<span className="line-clamp-2 text-xs leading-tight font-semibold wrap-anywhere">
					{recipe.title}
				</span>
				<span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
					<SiteIcon url={recipe.url} />
					<span className="truncate">
						{busy ? 'grabbing the page…' : recipe.siteName}
					</span>
				</span>
			</span>
		</>
	)
}
