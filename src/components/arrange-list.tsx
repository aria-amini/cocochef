import { CaretDownIcon, Plus } from '@phosphor-icons/react'

import { sectionLabelClassName } from '@/components/recipe-form'
import { cn } from '@/lib/utils/ui'

// A recipe's lists read like an index card: one card, a hairline between rows,
// and the field you are in lit from inside.
export const listCardClassName =
	'border-input bg-card divide-border flex flex-col divide-y rounded-xl border'

export const listRowClassName =
	'relative flex min-w-0 items-start first:rounded-t-xl last:rounded-b-xl focus-within:outline-kitchen-eggplant focus-within:z-10 focus-within:outline-2 focus-within:-outline-offset-2'

// The text of a row, without the field's own frame.
export const listFieldClassName =
	'min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base font-semibold outline-none'

// The list's last row, where the next one goes: faint, in the rows' own
// columns, so the list reads as one card that keeps going. Smaller actions sit
// at its end.
export function ListAddRow({
	what,
	label,
	onAdd,
	children,
}: {
	// What the row adds, such as "ingredient".
	what: string
	// Names the row when there are several of them, such as one per section.
	label?: string | undefined
	onAdd: () => void
	children?: React.ReactNode
}) {
	return (
		<li className={cn(listRowClassName, 'items-center pr-1')}>
			<button
				type="button"
				aria-label={label ?? `add ${what}`}
				onClick={onAdd}
				className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm font-semibold whitespace-nowrap transition-colors"
			>
				<span aria-hidden className="grid size-6 shrink-0 place-items-center">
					<Plus size={14} weight="bold" />
				</span>
				{/* Beside other actions on a phone, the plus says "add". */}
				<span className="truncate">
					<span className={cn(children ? 'max-sm:hidden' : undefined)}>
						add{' '}
					</span>
					{what}
				</span>
			</button>
			{children}
		</li>
	)
}

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

// A list's title, with any actions beside it. On a phone the title folds the
// list away, saying what it holds, so a long recipe is quick to get around.
export function ListHeader({
	title,
	fold,
	children,
}: {
	title: string
	fold?:
		| {
				folded: boolean
				onFold: () => void
				summary: string
				// A glimpse of what is inside, such as the first foods' pictures.
				preview?: React.ReactNode
		  }
		| undefined
	children?: React.ReactNode
}) {
	const label = cn(
		sectionLabelClassName,
		'flex min-w-0 flex-1 items-center whitespace-nowrap',
	)

	// Folded on a phone, the list is a card of its own: its name, what it
	// holds, a glimpse of it, and the whole card to tap open.
	const card = fold?.folded ? (
		<button
			type="button"
			aria-expanded={false}
			aria-label={`${title}, ${fold.summary}`}
			onClick={fold.onFold}
			className="bg-card border-input flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left md:hidden"
		>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="text-base font-bold">{title}</span>
				<span className="text-muted-foreground truncate text-sm">
					{fold.summary}
				</span>
			</span>
			{fold.preview}
			<CaretDownIcon
				size={14}
				weight="bold"
				aria-hidden
				className="text-muted-foreground shrink-0 -rotate-90"
			/>
		</button>
	) : null

	return (
		<>
			{card}
			<div
				className={cn(
					'flex min-h-11 items-center gap-2',
					fold?.folded && 'max-md:hidden',
				)}
			>
				{/* The fieldset's legend names the group; this is its face. */}
				<span aria-hidden className={cn(label, fold && 'max-md:hidden')}>
					{title}
				</span>
				{fold ? (
					<button
						type="button"
						aria-expanded={!fold.folded}
						aria-label={title}
						onClick={fold.onFold}
						className={cn(label, 'min-h-11 gap-1.5 text-left md:hidden')}
					>
						<CaretDownIcon
							size={12}
							weight="bold"
							aria-hidden
							className={cn(
								'shrink-0 transition-transform',
								fold.folded && '-rotate-90',
							)}
						/>
						{title}
					</button>
				) : null}
				{/* Folded, the list's actions wait with it. */}
				<div
					className={cn(
						'flex items-center gap-2',
						fold?.folded && 'max-md:hidden',
					)}
				>
					{children}
				</div>
			</div>
		</>
	)
}

// What a folded list holds: "7 ingredients", or "empty".
export function foldSummary(total: number, one: string, many: string) {
	return total ? `${total} ${total === 1 ? one : many}` : 'empty'
}
