import { Menu } from '@base-ui/react/menu'
import { DotsThreeIcon, type Icon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils/ui'

export type RecipeMenuItem = {
	key: string
	label: string
	icon: Icon
	onSelect: () => void
	disabled?: boolean | undefined
}

// What can be done to a recipe, folded behind one quiet "⋯" across from the
// way back, so the bar that stays while the page scrolls carries no words.
// The grocery list folds its own changes the same way.
export function RecipeMenu({
	items,
	label = 'recipe options',
	mark: Mark = DotsThreeIcon,
	size = 'size-11',
}: {
	items: readonly RecipeMenuItem[]
	label?: string
	// The trigger's mark: "⋯" unless the menu is a row's own.
	mark?: Icon
	size?: 'size-11' | 'size-10'
}) {
	if (!items.length) return null

	return (
		<Menu.Root>
			<Menu.Trigger
				aria-label={label}
				className={cn(
					'text-muted-foreground hover:bg-muted/60 hover:text-foreground data-popup-open:bg-muted/60 grid shrink-0 place-items-center rounded-md transition-colors',
					size,
				)}
			>
				<Mark
					size={Mark === DotsThreeIcon ? 22 : 16}
					weight="bold"
					aria-hidden
				/>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner className="z-50" align="end" sideOffset={6}>
					<Menu.Popup className="floating bg-background flex w-52 flex-col overflow-hidden py-1 outline-none">
						{items.map(({ key, label, icon: ItemMark, onSelect, disabled }) => (
							<Menu.Item
								key={key}
								disabled={disabled}
								onClick={onSelect}
								className="data-highlighted:bg-kitchen-yolk/40 flex min-h-11 w-full cursor-default items-center gap-2.5 px-3 text-sm font-semibold outline-none select-none data-disabled:opacity-50"
							>
								<ItemMark size={16} weight="bold" aria-hidden />
								{label}
							</Menu.Item>
						))}
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	)
}
