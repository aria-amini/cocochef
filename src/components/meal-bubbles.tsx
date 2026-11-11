import { Menu } from '@base-ui/react/menu'
import { CaretDownIcon, XIcon } from '@phosphor-icons/react'

import { PantrySprite } from '@/components/pantry-sprite'
import type { PartCount } from '@/lib/assistant/meal-parts'
import { cn } from '@/lib/utils/ui'

// The parts of a meal, as bubbles in the order Chlebowski picks them.
export const partBubbles = [
	{ key: 'cuisine', label: 'cuisine', counts: 'cuisines' },
	{ key: 'flavor', label: 'flavor', counts: 'flavors' },
	{ key: 'protein', label: 'protein', counts: 'proteins' },
	{ key: 'form', label: 'dish', counts: 'forms' },
] as const

const chipClassName =
	'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors'

const unsetChipClassName =
	'border-input text-muted-foreground hover:text-foreground border border-dashed'

const partItemClassName =
	'flex w-full cursor-default items-center gap-3 px-3 py-2.5 text-sm font-semibold outline-none select-none data-highlighted:bg-kitchen-yolk/40'

// One filter as a bubble: tap to choose from what the list holds; choices
// with nothing left are never offered. A part of a meal shows its flag or
// food; another filter (the recipe's site) brings its own `icon`.
export function PartBubble({
	label,
	value,
	options,
	onPick,
	icon,
}: {
	label: string
	value: string | undefined
	options: PartCount[] | undefined
	onPick: (name: string | undefined) => void
	icon?: ((name: string) => React.ReactNode) | undefined
}) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full',
				value && 'bg-kitchen-eggplant/10 text-kitchen-eggplant',
			)}
		>
			<Menu.Root>
				<Menu.Trigger
					aria-label={value ? `${label}: ${value}` : label}
					className={cn(
						chipClassName,
						value ? 'hover:bg-kitchen-eggplant/20 pr-1.5' : unsetChipClassName,
					)}
				>
					{value ?? label}
					<CaretDownIcon size={12} weight="bold" aria-hidden />
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Positioner
						className="z-50"
						side="bottom"
						align="start"
						sideOffset={6}
					>
						<Menu.Popup className="floating bg-background max-h-80 w-64 overflow-y-auto py-1 outline-none">
							{options?.length ? (
								options.map((option) => (
									<Menu.Item
										key={option.name}
										className={partItemClassName}
										onClick={() =>
											onPick(option.name === value ? undefined : option.name)
										}
									>
										{icon ? (
											<span
												aria-hidden
												className="grid size-5 place-items-center"
											>
												{icon(option.name)}
											</span>
										) : cuisineFlags.get(option.name) ? (
											<span
												aria-hidden
												className="grid size-5 place-items-center"
											>
												{cuisineFlags.get(option.name)}
											</span>
										) : (
											<PantrySprite
												look={{ key: option.sprite }}
												className="size-5"
											/>
										)}
										<span className="flex-1">{option.name}</span>
									</Menu.Item>
								))
							) : (
								<p className="text-muted-foreground px-3 py-2.5 text-sm">
									nothing left with these filters
								</p>
							)}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{value ? (
				<button
					type="button"
					aria-label={`remove ${value}`}
					onClick={() => onPick(undefined)}
					className="hover:bg-kitchen-eggplant/20 mr-1 grid size-7 place-items-center rounded-full"
				>
					<XIcon size={12} weight="bold" aria-hidden />
				</button>
			) : null}
		</span>
	)
}

// A cuisine shows the flag of where it comes from; a region with many
// countries borrows the best known one's.
const cuisineFlags = new Map([
	['korean', '🇰🇷'],
	['japanese', '🇯🇵'],
	['chinese', '🇨🇳'],
	['thai', '🇹🇭'],
	['vietnamese', '🇻🇳'],
	['indian', '🇮🇳'],
	['middle eastern', '🇱🇧'],
	['greek', '🇬🇷'],
	['italian', '🇮🇹'],
	['mexican', '🇲🇽'],
	['american south', '🇺🇸'],
	['caribbean', '🇯🇲'],
	['french', '🇫🇷'],
	['spanish', '🇪🇸'],
])
