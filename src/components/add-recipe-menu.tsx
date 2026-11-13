import { Menu } from '@base-ui/react/menu'
import {
	ClipboardTextIcon,
	LinkSimpleIcon,
	PencilSimpleIcon,
	PlusIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'

import { useRecipeActions } from '@/components/recipe-actions'

const itemClassName =
	'flex w-full cursor-default items-center gap-3 px-3 py-3 text-sm font-semibold outline-none select-none data-highlighted:bg-kitchen-yolk/40'

// Every way to add a recipe of your own, behind a plus or the shelf's add
// tile: write one, bring one in from a link, or paste its text. Finding one
// is the search box's job.
export function AddRecipeMenu({
	className,
	iconSize = 22,
	side = 'bottom',
	align = 'end',
	label = 'add recipe',
	children,
}: {
	className: string
	iconSize?: number
	side?: 'top' | 'bottom'
	align?: 'start' | 'end'
	label?: string
	// What the trigger shows in place of the plus alone.
	children?: React.ReactNode
}) {
	const { importLink, pasteText } = useRecipeActions()

	return (
		<Menu.Root>
			<Menu.Trigger aria-label={label} className={className}>
				{children ?? <PlusIcon size={iconSize} weight="bold" aria-hidden />}
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner
					className="z-50"
					side={side}
					align={align}
					sideOffset={8}
				>
					<Menu.Popup className="floating bg-background w-60 overflow-hidden py-1 outline-none">
						<Menu.LinkItem
							className={itemClassName}
							render={<Link to="/recipes/new" />}
						>
							<PencilSimpleIcon size={18} weight="bold" aria-hidden />
							blank recipe
						</Menu.LinkItem>
						<Menu.Item className={itemClassName} onClick={() => importLink()}>
							<LinkSimpleIcon size={18} weight="bold" aria-hidden />
							import url
						</Menu.Item>
						<Menu.Item className={itemClassName} onClick={pasteText}>
							<ClipboardTextIcon size={18} weight="bold" aria-hidden />
							paste text
						</Menu.Item>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	)
}
