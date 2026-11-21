import { useQuery } from '@tanstack/react-query'

import { PantrySprite } from '@/components/pantry-sprite'
import { productPhoto } from '@/lib/pantry/photo'
import type { SpriteLook } from '@/lib/pantry/tinted-sprites'
import { cn } from '@/lib/utils/ui'

// A food's picture: the package, when the cook named a brand and a photo of
// it is found, and the food's own sprite otherwise, and while it is looked for.
export function FoodPicture({
	look,
	food,
	brand,
	className,
}: {
	look: SpriteLook
	food: string
	brand: string | null
	className?: string | undefined
}) {
	const photo = useQuery({
		queryKey: ['product-photo', food.toLowerCase(), brand?.toLowerCase()],
		queryFn: () => productPhoto({ data: { food, brand: brand ?? '' } }),
		enabled: !!brand,
		staleTime: Infinity,
	}).data

	if (brand && photo)
		return (
			<img
				src={photo}
				alt=""
				loading="lazy"
				className={cn('shrink-0 rounded-md object-contain', className)}
			/>
		)

	return <PantrySprite look={look} className={cn(className)} />
}
