import {
	closestCenter,
	defaultDropAnimationSideEffects,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	MeasuringStrategy,
	PointerSensor,
	useSensor,
	useSensors,
	type Announcements,
	type DragEndEvent,
	type DragStartEvent,
	type DropAnimation,
	type UniqueIdentifier,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical } from '@phosphor-icons/react'
import { useId, useState } from 'react'

import { cn } from '@/lib/utils/ui'

const screenReaderInstructions = {
	draggable:
		'press space to pick it up, the arrow keys to move it, space to drop it, or escape to put it back',
}

// Rows make way and a dropped row settles on the same quick ease-out, so the
// list reads as one motion rather than rows snapping into place.
const ease = 'cubic-bezier(0.2, 0, 0, 1)'

const rowTransition = { duration: 200, easing: ease }

const dropAnimation: DropAnimation = {
	duration: 220,
	easing: ease,
	sideEffects: defaultDropAnimationSideEffects({
		styles: { active: { opacity: '0' } },
	}),
}

const reducedMotion = () =>
	typeof window !== 'undefined' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Rows in an order the cook sets, by drag or by keyboard. `describe` names a
// row for screen readers ("ingredient 2, garlic"), never by its id. The row
// being moved is drawn by `overlay`, lifted above the list, while its place in
// the list holds the gap it will drop into. `onPickUp` and `onPutDown` let a
// list change what it shows while a row is carried.
export function SortableList({
	items,
	describe,
	onMove,
	overlay,
	onPickUp,
	onPutDown,
	children,
}: {
	items: string[]
	describe: (id: string) => string
	onMove: (from: number, to: number) => void
	overlay: (id: string) => React.ReactNode
	onPickUp?: (id: string) => void
	onPutDown?: () => void
	children: React.ReactNode
}) {
	// A stable id keeps dnd-kit's own ids the same on the server and the client.
	const id = useId()
	const [carried, setCarried] = useState<string>()

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

	function start({ active }: DragStartEvent) {
		setCarried(String(active.id))
		onPickUp?.(String(active.id))

		// A short tick where the phone supports it: the row is in hand.
		if ('vibrate' in navigator) navigator.vibrate(8)
	}

	function end({ active, over }: DragEndEvent) {
		setCarried(undefined)

		if (over && active.id !== over.id) {
			const from = items.indexOf(String(active.id))
			const to = items.indexOf(String(over.id))

			if (from >= 0 && to >= 0) onMove(from, to)
		}

		onPutDown?.()
	}

	return (
		<DndContext
			id={id}
			sensors={sensors}
			collisionDetection={closestCenter}
			// A carried section folds the list, so places are measured again.
			measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
			modifiers={[restrictToVerticalAxis]}
			accessibility={{ announcements, screenReaderInstructions }}
			onDragStart={start}
			onDragEnd={end}
			onDragCancel={() => {
				setCarried(undefined)
				onPutDown?.()
			}}
		>
			<SortableContext items={items} strategy={verticalListSortingStrategy}>
				{children}
			</SortableContext>
			<DragOverlay dropAnimation={reducedMotion() ? null : dropAnimation}>
				{carried ? (
					<div className="bg-card border-input scale-[1.02] rounded-xl border shadow-md">
						{overlay(carried)}
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}

// One row of an arranged list; `children` receives the drag handle to place in
// the row. The handle shows `grip`, or six dots. While the row is carried its
// place stays open as a faint slot.
export function SortableRow({
	id,
	label,
	grip,
	className,
	handleClassName,
	children,
}: {
	id: string
	label: string
	grip?: React.ReactNode
	className?: string
	handleClassName?: string
	children: (handle: React.ReactNode) => React.ReactNode
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, transition: rowTransition })

	return (
		<li
			ref={setNodeRef}
			style={{
				// dnd-kit computes the offset and its timing at runtime.
				// oxlint-disable-next-line shadcn/no-inline-styles
				transform: CSS.Translate.toString(transform),
				// oxlint-disable-next-line shadcn/no-inline-styles
				transition,
			}}
			data-dragging={isDragging}
			className={cn(
				'group flex items-center',
				isDragging && 'bg-kitchen-eggplant/5 *:opacity-0',
				className,
			)}
		>
			{children(
				<DragHandle
					label={label}
					grip={grip}
					className={handleClassName}
					activator={setActivatorNodeRef}
					attributes={attributes}
					listeners={listeners}
				/>,
			)}
		</li>
	)
}

function DragHandle({
	label,
	grip,
	className,
	activator,
	attributes,
	listeners,
}: {
	label: string
	grip: React.ReactNode
	className?: string | undefined
	activator: (node: HTMLElement | null) => void
	attributes: ReturnType<typeof useSortable>['attributes']
	listeners: ReturnType<typeof useSortable>['listeners']
}) {
	return (
		<button
			type="button"
			ref={activator}
			{...attributes}
			{...listeners}
			// Pressing the handle neither focuses it nor selects text: a focused
			// row opens for editing, and the row being carried is not being
			// written. Whatever was being written lets go.
			onMouseDown={(event) => {
				event.preventDefault()

				if (document.activeElement instanceof HTMLElement)
					document.activeElement.blur()
			}}
			aria-label={label}
			className={cn(
				'text-muted-foreground hover:text-foreground grid size-11 shrink-0 cursor-grab touch-none place-items-center active:cursor-grabbing',
				className,
			)}
		>
			{grip ?? <DotsSixVertical size={18} weight="bold" aria-hidden />}
		</button>
	)
}
