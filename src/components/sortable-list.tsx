import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type Announcements,
	type DragEndEvent,
	type UniqueIdentifier,
} from '@dnd-kit/core'
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import { useId } from 'react'

import { cn } from '@/lib/utils/ui'

const screenReaderInstructions = {
	draggable:
		'press space to pick it up, the arrow keys to move it, space to drop it, or escape to put it back',
}

// Rows in an order the cook sets, by drag or by keyboard. `describe` names a
// row for screen readers ("ingredient 2, garlic"), never by its id.
export function SortableList({
	items,
	describe,
	onMove,
	children,
}: {
	items: string[]
	describe: (id: string) => string
	onMove: (from: number, to: number) => void
	children: React.ReactNode
}) {
	// A stable id keeps dnd-kit's own ids the same on the server and the client.
	const id = useId()

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	const name = (target: UniqueIdentifier) => describe(String(target))

	const position = (target: UniqueIdentifier) =>
		`position ${items.indexOf(String(target)) + 1} of ${items.length}`

	const announcements: Announcements = {
		onDragStart: ({ active }) => `picked up ${name(active.id)}`,
		onDragOver: ({ active, over }) =>
			over ? `${name(active.id)} moved to ${position(over.id)}` : undefined,
		onDragEnd: ({ active, over }) =>
			over
				? `${name(active.id)} dropped at ${position(over.id)}`
				: `${name(active.id)} put back`,
		onDragCancel: ({ active }) => `${name(active.id)} put back`,
	}

	function end({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return

		const from = items.indexOf(String(active.id))
		const to = items.indexOf(String(over.id))

		if (from >= 0 && to >= 0) onMove(from, to)
	}

	return (
		<DndContext
			id={id}
			sensors={sensors}
			collisionDetection={closestCenter}
			accessibility={{ announcements, screenReaderInstructions }}
			onDragEnd={end}
		>
			<SortableContext items={items} strategy={verticalListSortingStrategy}>
				{children}
			</SortableContext>
		</DndContext>
	)
}

// One draggable row; `children` receives the drag handle to place in the row.
// The handle shows `grip`, or six dots.
export function SortableRow({
	id,
	label,
	grip,
	className,
	children,
}: {
	id: string
	label: string
	grip?: React.ReactNode
	className?: string
	children: (handle: React.ReactNode) => React.ReactNode
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		isDragging,
	} = useSortable({ id })

	return (
		<li
			ref={setNodeRef}
			style={{
				// dnd-kit computes the drag offset at runtime.
				// oxlint-disable-next-line shadcn/no-inline-styles
				transform: CSS.Translate.toString(transform),
			}}
			data-dragging={isDragging}
			className={cn(
				'group flex items-stretch gap-1',
				isDragging
					? 'bg-card relative z-10 rounded-xl shadow-md'
					: 'transition-transform',
				className,
			)}
		>
			{children(
				<button
					type="button"
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					aria-label={label}
					className="text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant grid w-9 shrink-0 cursor-grab touch-none place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
				>
					{grip ?? <DotsSixVertical size={16} weight="bold" aria-hidden />}
				</button>,
			)}
		</li>
	)
}
