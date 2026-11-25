import type { CSSProperties } from 'react'

import { RecipeGlyph } from '@/components/recipe-glyph'
import type { Readiness } from '@/lib/pantry/readiness'
import { sizedPhoto } from '@/lib/photos/sized'
import { tileColors, type TileColor } from '@/lib/recipes/tile-color'
import { cn } from '@/lib/utils/ui'

// A recipe as a tile, the same wherever recipes are laid out in a grid: its
// photo over a paper title bar, or, without one, its own ingredient tint with
// a glyph in the corner and the name set large. The caller wraps it in the
// link and adds what sits on top.
export function recipeTileClassName({
	color,
	photo,
	className,
}: {
	color: TileColor
	photo: boolean
	className?: string | undefined
}) {
	return cn(
		'border-border relative flex aspect-square flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md md:aspect-auto md:h-full',
		photo ? 'bg-card text-foreground' : tileColors[color],
		className,
	)
}

// How ready a recipe is, in words to follow its name.
function readyWords({ home, listed, total }: Readiness) {
	if (home === total) return 'all home'

	return listed
		? `${home} home · ${listed} on list`
		: `${home} of ${total} home`
}

// How ready a recipe is to cook, seen down a shelf before it's read: basil
// for what's home, then yolk for what's on the list for it. What's left of
// the track is still to get.
function ReadyBar({
	ready,
	className,
}: {
	ready: Readiness
	className: string
}) {
	const vars: CSSProperties & Record<`--${string}`, string> = {
		'--home': `${(ready.home / ready.total) * 100}%`,
		'--listed': `${(ready.listed / ready.total) * 100}%`,
	}

	return (
		<span
			aria-hidden
			style={vars}
			className={cn(
				'bg-foreground/15 absolute inset-x-0 flex h-1.5',
				className,
			)}
		>
			<span className="bg-kitchen-basil w-(--home)" />
			<span className="bg-kitchen-yolk w-(--listed)" />
		</span>
	)
}

export function RecipeTileFace({
	title,
	imageUrl,
	detail,
	ready,
}: {
	title: string
	imageUrl: string | null
	// A short line under the name, such as how long it takes.
	detail?: string | undefined
	// What the kitchen has of it, once the pantry knows anything.
	ready?: Readiness | undefined
}) {
	const words = [detail, ready ? readyWords(ready) : undefined].filter(Boolean)

	if (imageUrl)
		return (
			<>
				<div className="relative min-h-0 flex-1">
					<img
						src={sizedPhoto(imageUrl, 400)}
						alt=""
						loading="lazy"
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
				<div className="border-border bg-card relative flex shrink-0 flex-col gap-0.5 border-t px-2.5 py-1.5">
					{/* Along the photo's foot, over the line under it. */}
					{ready ? <ReadyBar ready={ready} className="-top-px" /> : null}
					<h3 className="line-clamp-2 text-sm leading-tight font-bold wrap-anywhere">
						{title}
					</h3>
					{words.map((line) => (
						<p key={line} className="text-foreground/70 text-xs font-semibold">
							{line}
						</p>
					))}
				</div>
			</>
		)

	return (
		<>
			<RecipeGlyph
				title={title}
				size={40}
				className="text-foreground/60 absolute top-3 right-3"
			/>
			<div className="absolute right-3 bottom-2.5 left-3 flex flex-col gap-1">
				<h3 className="line-clamp-4 text-xl leading-tight font-bold wrap-anywhere">
					{title}
				</h3>
				{words.map((line) => (
					<p key={line} className="text-foreground/70 text-xs font-semibold">
						{line}
					</p>
				))}
			</div>
			{/* Without a photo, along the tile's foot. */}
			{ready ? <ReadyBar ready={ready} className="bottom-0" /> : null}
		</>
	)
}
