import { BasketIcon, GrainsIcon, SnowflakeIcon } from '@phosphor-icons/react'

import type { PantrySpot } from '@/lib/pantry/spots'

// Where food lives, as a line mark in the same hand as the app's other
// icons. Phosphor draws no fridge, so it is drawn here in Phosphor's bold
// weight: a tall rounded box, its freezer door, and two handles.
function FridgeIcon({ size }: { size: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 256 256"
			fill="none"
			stroke="currentColor"
			strokeWidth={24}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<rect x="56" y="24" width="144" height="208" rx="16" />
			<line x1="56" y1="104" x2="200" y2="104" />
			<line x1="88" y1="56" x2="88" y2="72" />
			<line x1="88" y1="136" x2="88" y2="168" />
		</svg>
	)
}

export function SpotIcon({
	spot,
	size = 18,
}: {
	spot: PantrySpot
	size?: number
}) {
	switch (spot) {
		case 'fridge':
			return <FridgeIcon size={size} />
		case 'counter':
			return <BasketIcon size={size} weight="bold" aria-hidden />
		case 'pantry':
			return <GrainsIcon size={size} weight="bold" aria-hidden />
		case 'freezer':
			return <SnowflakeIcon size={size} weight="bold" aria-hidden />
	}
}
