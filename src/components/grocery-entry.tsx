import { PlusIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { AmountBar, lineCompletion } from '@/components/amount-bar'
import { IngredientCombobox } from '@/components/ingredient-combobox'
import { PantrySprite } from '@/components/pantry-sprite'
import { buttonVariants } from '@/components/ui/button'
import { pantryCategoryLabels } from '@/lib/pantry/model'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { cn } from '@/lib/utils/ui'

// The item about to go on the list, drawn as it will look there: a circle to
// tick, the food's picture once it is named, and the text. The circle is
// dashed, since the item is not on the list yet. The amount toolbar opens
// under it once something is typed.
function DraftRow({
	text,
	onText,
	onSubmit,
	onBlur,
	inputRef,
	note,
}: {
	text: string
	onText: (text: string) => void
	onSubmit: () => void
	onBlur?: (() => void) | undefined
	inputRef?: React.Ref<HTMLTextAreaElement> | undefined
	note?: string | undefined
}) {
	const look = text.trim() ? ingredientItemLook(text) : undefined
	// A press inside the row, on the amount toolbar or a suggestion. A phone
	// moves focus off the field on touch, before the button's click, so the
	// row must not take that for leaving.
	const pressing = useRef(false)

	return (
		<div
			onPointerDownCapture={() => {
				pressing.current = true
			}}
			// After a press inside, the field takes focus back, so typing goes on.
			onClickCapture={(event) => {
				if (!pressing.current) return
				pressing.current = false
				const field = event.currentTarget.querySelector('textarea')

				if (field && document.activeElement !== field) field.focus()
			}}
			onBlur={(event) => {
				if (pressing.current) return

				if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.()
			}}
			className="bg-card border-input focus-within:border-foreground/40 rounded-xl border transition-colors"
		>
			<div className="relative flex min-h-13 items-center gap-3 pr-1 pl-3">
				<span
					aria-hidden
					className="border-foreground/40 size-6 shrink-0 rounded-full border-2 border-dashed"
				/>
				<span aria-hidden className="grid size-6 shrink-0 place-items-center">
					{look ? <PantrySprite look={look} className="size-6" /> : null}
				</span>
				<div className="min-w-0 flex-1">
					<IngredientCombobox
						bare
						required={false}
						name="grocery"
						label="add an item"
						placeholder="add an item"
						maxLength={200}
						completion={lineCompletion}
						value={text}
						onChange={onText}
						inputRef={inputRef}
						inputClassName="min-h-11 px-0 py-2.5 font-normal"
						onKeyDown={(event) => {
							if (event.key !== 'Enter') return
							event.preventDefault()
							onSubmit()
						}}
					/>
				</div>
				{text.trim() ? (
					<button
						type="button"
						onPointerDown={(event) => event.preventDefault()}
						onClick={onSubmit}
						className={buttonVariants({ className: 'min-h-9 shrink-0' })}
					>
						add
					</button>
				) : null}
			</div>
			{text.trim() ? <AmountBar line={text} onChange={onText} /> : null}
			<p
				aria-live="polite"
				className={cn(
					'text-muted-foreground px-3 pb-2 text-xs font-semibold',
					!note && 'sr-only',
				)}
			>
				{note}
			</p>
		</div>
	)
}

// On a wide screen the draft row waits over the list, always ready.
export function GroceryField({
	onAdd,
	inputRef,
}: {
	onAdd: (text: string) => void
	inputRef?: React.Ref<HTMLTextAreaElement> | undefined
}) {
	const [text, setText] = useState('')

	function submit() {
		const trimmed = text.trim()

		if (!trimmed) return
		onAdd(trimmed)
		setText('')
	}

	return (
		<div className="hidden md:block">
			<DraftRow
				text={text}
				onText={setText}
				onSubmit={submit}
				inputRef={inputRef}
			/>
		</div>
	)
}

// On a phone a round plus waits over the tab bar, as on the other tabs. A tap
// puts a draft row at the end of the list, focused in the same tap so the
// keyboard comes up with it and scrolls it into view. Enter adds the item and
// leaves a fresh draft for the next; enter on an empty draft or a tap
// elsewhere puts it away, adding whatever was typed. Each item says which
// aisle it went to, since the list may not show it.
export function useGroceryComposer(onAdd: (text: string) => void) {
	const [open, setOpen] = useState(false)
	const [text, setText] = useState('')
	const [note, setNote] = useState('')
	const field = useRef<HTMLTextAreaElement>(null)

	function close() {
		const trimmed = text.trim()

		if (trimmed) onAdd(trimmed)
		setText('')
		setNote('')
		setOpen(false)
	}

	function submit() {
		const trimmed = text.trim()

		if (!trimmed) {
			field.current?.blur()

			return
		}

		onAdd(trimmed)
		setNote(`added to ${pantryCategoryLabels[ingredientCategory(trimmed)]}`)
		setText('')
	}

	// Opened and focused in the same tap, so the keyboard comes up with it.
	function start() {
		flushSync(() => setOpen(true))
		field.current?.focus()
	}

	const button = open ? null : (
		<button
			type="button"
			aria-label="add items"
			onClick={start}
			className="bg-kitchen-yolk bottom-fab fixed right-4 z-20 grid size-14 place-items-center rounded-full shadow-md transition-colors hover:brightness-95 md:hidden"
		>
			<PlusIcon size={26} weight="bold" aria-hidden />
		</button>
	)

	const draft = open ? (
		<div className="md:hidden">
			<DraftRow
				text={text}
				onText={setText}
				onSubmit={submit}
				onBlur={close}
				inputRef={field}
				note={note}
			/>
		</div>
	) : null

	return { open, start, button, draft }
}
