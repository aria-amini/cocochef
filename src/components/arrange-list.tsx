import { ArrowsDownUpIcon, CheckIcon } from '@phosphor-icons/react'

import { fieldLabelClassName } from '@/components/recipe-form'
import { cn } from '@/lib/utils/ui'

// A recipe's lists read like an index card: one card, a hairline between rows,
// and the field you are in lit from inside.
export const listCardClassName =
	'border-input bg-card divide-border flex flex-col divide-y rounded-xl border'

export const listRowClassName =
	'relative flex min-w-0 items-start first:rounded-t-xl last:rounded-b-xl focus-within:outline-kitchen-eggplant focus-within:z-10 focus-within:outline-2 focus-within:-outline-offset-2'

// The text of a row, without the field's own frame.
export const listFieldClassName =
	'min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base font-medium outline-none'

export const listAddClassName =
	'border-input text-muted-foreground hover:text-foreground hover:bg-card flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-semibold transition-colors'

// A row's own controls, there when the row is in use: hovered, or holding
// focus. A press keeps focus in the row's field, so the controls stay put
// until the press lands; Tab still reaches them in order.
export function RowAction({
	label,
	onClick,
	children,
}: {
	label: string
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onPointerDown={(event) => event.preventDefault()}
			onClick={onClick}
			className="text-muted-foreground hover:text-foreground pointer-events-none grid size-11 shrink-0 place-items-center opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:opacity-100"
		>
			{children}
		</button>
	)
}

// A list's title with the switch into arranging: the rows give up their
// fields for handles, and come back when the cook is done.
export function ListHeader({
	title,
	icon,
	arranging,
	canArrange,
	onArrange,
	children,
}: {
	title: string
	icon?: React.ReactNode
	arranging: boolean
	canArrange: boolean
	onArrange: () => void
	// More of the list's own actions, shown while not arranging.
	children?: React.ReactNode
}) {
	return (
		<div className="flex min-h-11 items-center gap-2">
			{/* The fieldset's legend names the group; this is its face. */}
			<span
				aria-hidden
				className={cn(
					fieldLabelClassName,
					'flex min-w-0 flex-1 items-center text-lg whitespace-nowrap',
				)}
			>
				{icon}
				{title}
			</span>
			{arranging ? null : children}
			{canArrange || arranging ? (
				<button
					type="button"
					aria-pressed={arranging}
					aria-label={
						arranging ? `done arranging ${title}` : `arrange ${title}`
					}
					onClick={onArrange}
					className={cn(
						'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
						arranging
							? 'bg-foreground text-background'
							: 'text-muted-foreground hover:text-foreground hover:bg-card',
					)}
				>
					{arranging ? (
						<CheckIcon size={14} weight="bold" aria-hidden />
					) : (
						<ArrowsDownUpIcon size={14} weight="bold" aria-hidden />
					)}
					{arranging ? 'done' : 'arrange'}
				</button>
			) : null}
		</div>
	)
}
