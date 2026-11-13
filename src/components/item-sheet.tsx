import { Dialog } from '@base-ui/react/dialog'
import { Popover } from '@base-ui/react/popover'
import { createContext, useContext, useSyncExternalStore } from 'react'

const wideQuery = '(min-width: 48rem)'

const subscribeWide = (notify: () => void) => {
	const query = matchMedia(wideQuery)
	query.addEventListener('change', notify)

	return () => query.removeEventListener('change', notify)
}

// Wide enough for a popover beside the row, rather than a sheet.
function useWide() {
	return useSyncExternalStore(
		subscribeWide,
		() => matchMedia(wideQuery).matches,
		() => false,
	)
}

// Which root the sheet rendered, so its done button closes the right one.
const SheetMode = createContext<'popover' | 'dialog'>('dialog')

type InitialFocus = (
	type: 'mouse' | 'touch' | 'pen' | 'keyboard' | '',
) => boolean | HTMLElement | null | void

// One item up close, opened from its row. On a wide screen it opens right
// under the row, where the pointer already is; on a phone it rises from the
// bottom, in reach of the thumb. Escape closes it as a cancel where there
// is something to cancel; a tap outside or a close button as done.
export function ItemSheet({
	anchor,
	title,
	onClose,
	initialFocus,
	children,
}: {
	anchor: () => Element | null
	title: string
	onClose: (cancelled: boolean) => void
	initialFocus?: InitialFocus | undefined
	children: React.ReactNode
}) {
	const wide = useWide()

	// Closed, focus goes back to the row it opened from, where the cook was.
	const backToRow = () => {
		const row = anchor()

		return row instanceof HTMLElement ? row : true
	}

	// A row low on the screen opens its details below the fold: the page
	// brings them into view, and again if they grow.
	const keepInView = (node: HTMLElement | null) => {
		if (!node) return
		const reveal = () => node.scrollIntoView({ block: 'nearest' })
		const first = setTimeout(reveal, 60)
		const observer = new ResizeObserver(reveal)

		observer.observe(node)

		return () => {
			clearTimeout(first)
			observer.disconnect()
		}
	}

	// A row folded out of sight leaves nothing to open beside: the sheet
	// opens instead.
	if (wide && anchor())
		return (
			<Popover.Root
				open
				modal="trap-focus"
				onOpenChange={(open, details) => {
					if (!open) onClose(details.reason === 'escape-key')
				}}
			>
				<Popover.Portal>
					<Popover.Positioner
						anchor={anchor}
						side="bottom"
						align="start"
						sideOffset={4}
						collisionPadding={16}
						// Under its row when there is room, above it near the
						// bottom of the page, so it never runs past the page's end.
						collisionAvoidance={{ side: 'flip', align: 'shift' }}
						className="z-50"
					>
						<Popover.Popup
							ref={keepInView}
							initialFocus={initialFocus}
							finalFocus={backToRow}
							className="floating bg-card flex w-80 flex-col gap-4 rounded-xl p-4 outline-none"
						>
							<Popover.Title className="sr-only">{title}</Popover.Title>
							<SheetMode value="popover">{children}</SheetMode>
						</Popover.Popup>
					</Popover.Positioner>
				</Popover.Portal>
			</Popover.Root>
		)

	return (
		<Dialog.Root
			open
			onOpenChange={(open, details) => {
				if (!open) onClose(details.reason === 'escape-key')
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
				<Dialog.Popup
					initialFocus={initialFocus}
					finalFocus={backToRow}
					className="bg-card fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-xl p-5 pb-8 outline-none"
				>
					<Dialog.Title className="sr-only">{title}</Dialog.Title>
					<SheetMode value="dialog">{children}</SheetMode>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	)
}

// Closes the sheet as done, from a button inside it.
export function ItemSheetDone({
	ref,
	className,
	children,
	...rest
}: {
	ref?: React.Ref<HTMLButtonElement>
	className?: string
	children: React.ReactNode
	'data-sheet-done'?: boolean
}) {
	const Close =
		useContext(SheetMode) === 'popover' ? Popover.Close : Dialog.Close

	return (
		<Close ref={ref} className={className} {...rest}>
			{children}
		</Close>
	)
}
