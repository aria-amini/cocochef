import type { CSSProperties } from 'react'

import { isTintedSprite, type SpriteLook } from '@/lib/pantry/tinted-sprites'
import { cn } from '@/lib/utils/ui'

// The picture for a food. A recolourable sprite is its fill mask painted in the
// food's colour, with the outline and shading drawn over it; any other sprite
// is a plain image. The size comes from className.
export function PantrySprite({
	look,
	className,
}: {
	look: SpriteLook
	className?: string
}) {
	if (!look.tint || !isTintedSprite(look.key)) {
		return (
			<img
				src={`/sprites/pantry/${look.key}.png`}
				alt=""
				className={cn('object-contain [image-rendering:pixelated]', className)}
			/>
		)
	}

	// The fill mask is smoothed when it scales, but it sits wholly under the
	// opaque outline, so no soft edge shows.
	const vars: CSSProperties & Record<`--${string}`, string> = {
		'--tint': look.tint,
		'--fill': `url(/sprites/pantry/tint/${look.key}.fill.png)`,
	}

	return (
		<span className={cn('relative inline-block', className)}>
			<span
				className="absolute inset-0 bg-(--tint) [mask-image:var(--fill)] [mask-size:100%_100%] [-webkit-mask-image:var(--fill)] [-webkit-mask-size:100%_100%]"
				style={vars}
			/>
			<img
				src={`/sprites/pantry/tint/${look.key}.png`}
				alt=""
				className="absolute inset-0 size-full object-contain [image-rendering:pixelated]"
			/>
		</span>
	)
}
