import { RecipeGlyph } from '@/components/recipe-glyph'
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

export function RecipeTileFace({
	title,
	imageUrl,
	detail,
}: {
	title: string
	imageUrl: string | null
	// A short line under the name, such as how long it takes.
	detail?: string | undefined
}) {
	if (imageUrl)
		return (
			<>
				<div className="relative min-h-0 flex-1">
					<img
						src={imageUrl}
						alt=""
						loading="lazy"
						className="absolute inset-0 size-full object-cover"
					/>
				</div>
				<div className="border-border bg-card flex shrink-0 flex-col gap-0.5 border-t px-2.5 py-1.5">
					<h3 className="line-clamp-2 text-sm leading-tight font-bold wrap-anywhere">
						{title}
					</h3>
					{detail ? (
						<p className="text-foreground/70 text-xs font-semibold">{detail}</p>
					) : null}
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
				{detail ? (
					<p className="text-foreground/70 text-xs font-semibold">{detail}</p>
				) : null}
			</div>
		</>
	)
}
