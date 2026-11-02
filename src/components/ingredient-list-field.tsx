import { arrayMove } from '@dnd-kit/sortable'
import { CarrotIcon, Plus, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import {
	IngredientCombobox,
	type LineCompletion,
} from '@/components/ingredient-combobox'
import {
	fieldLabelClassName,
	placeholderClassName,
} from '@/components/recipe-form'
import { SortableList, SortableRow } from '@/components/sortable-list'
import {
	formatIngredientHeading,
	ingredientHeading,
	parseIngredientLine,
} from '@/lib/recipes/ingredient-line'
import { pastedIngredients } from '@/lib/recipes/paste'
import { cn } from '@/lib/utils/ui'

// An ingredient is the line as the cook wrote it ("a knob of butter"); a
// heading row holds the section's name ("for the sauce").
type Row = { id: string; text: string; heading?: true | undefined }

function insertRows(rows: Row[], index: number, added: Row[]) {
	return [...rows.slice(0, index), ...added, ...rows.slice(index)]
}

function toRows(lines: string[]): Row[] {
	return (lines.length ? lines : ['']).map((line): Row => {
		const heading = ingredientHeading(line)

		return heading === undefined
			? { id: crypto.randomUUID(), text: line }
			: { id: crypto.randomUUID(), text: heading, heading: true }
	})
}

function lineOf(row: Row) {
	return row.heading ? formatIngredientHeading(row.text) : row.text.trim()
}

// Suggestions finish the food's name and leave the amount as typed.
const completion: LineCompletion = {
	query: (line) => parseIngredientLine(line).name,
	// The name is the line's last words, however they were spaced.
	apply: (line, suggestion) => {
		const words = parseIngredientLine(line).name.split(/\s+/).filter(Boolean)
		const name = new RegExp(`(?:\\S+\\s*){${words.length}}$`)

		return line.replace(name, '') + suggestion
	},
}

const addButtonClassName =
	'border-input text-muted-foreground hover:text-foreground hover:bg-card focus-visible:outline-kitchen-eggplant flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'

const iconButtonClassName =
	'text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2'

// One ingredient per row, written the way it would be on a card: amount, unit
// and food in one line, with the food's icon beside it. Enter starts the next
// row, an empty row backs out, and a pasted list splits into rows. Each row
// submits as one `ingredient` field; read the rows with `getAll`.
export function IngredientListField({
	defaultValue = [],
	onCountChange,
}: {
	defaultValue?: string[] | undefined
	onCountChange?: (count: number) => void
}) {
	const [rows, setRows] = useState(() => toRows(defaultValue))
	const inputs = useRef(new Map<string, HTMLElement>())
	const focusNext = useRef<string>(undefined)

	useEffect(() => {
		if (!focusNext.current) return
		inputs.current.get(focusNext.current)?.focus()
		focusNext.current = undefined
	}, [rows])

	useEffect(() => {
		onCountChange?.(
			rows.filter((row) => !row.heading && row.text.trim()).length,
		)
	}, [rows, onCountChange])

	const inputRef = (id: string) => (node: HTMLElement | null) => {
		if (node) inputs.current.set(id, node)
		else inputs.current.delete(id)
	}

	function update(id: string, patch: Partial<Row>) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
		)
	}

	function insertAfter(index: number, lines: string[]) {
		const added = toRows(lines)
		focusNext.current = added.at(-1)?.id
		setRows((current) => insertRows(current, index + 1, added))
	}

	// A heading goes above a lone empty starter row, else after the last row.
	function addHeading() {
		const added: Row = { id: crypto.randomUUID(), text: '', heading: true }

		focusNext.current = added.id
		setRows((current) => {
			const [only] = current

			return current.length === 1 && only && !lineOf(only)
				? [added, only]
				: [...current, added]
		})
	}

	function removeAt(index: number) {
		focusNext.current = rows[Math.max(index - 1, 0)]?.id

		setRows((current) =>
			current.length === 1
				? toRows([])
				: current.filter((_, position) => position !== index),
		)
	}

	// Enter starts the next row; backspace in an empty one removes it.
	function handleKey(
		event: React.KeyboardEvent<HTMLElement>,
		row: Row,
		index: number,
	) {
		if (event.nativeEvent.isComposing) return

		if (event.key === 'Enter') {
			event.preventDefault()

			if (row.heading || row.text.trim()) insertAfter(index, [''])
		} else if (event.key === 'Backspace' && !row.text && rows.length > 1) {
			event.preventDefault()
			removeAt(index)
		}
	}

	function paste(event: React.ClipboardEvent<HTMLElement>, row: Row) {
		const lines = pastedIngredients(event.clipboardData.getData('text'))

		if (lines.length < 2) return
		event.preventDefault()

		const [first = '', ...rest] = lines
		const [filled] = toRows([first])
		update(row.id, { text: filled?.text ?? '', heading: filled?.heading })
		insertAfter(
			rows.findIndex((current) => current.id === row.id),
			rest,
		)
	}

	function describe(id: string) {
		const index = rows.findIndex((row) => row.id === id)
		const row = rows[index]
		const what = row?.heading ? 'section' : 'ingredient'

		return [`${what} ${index + 1}`, row?.text.trim()].filter(Boolean).join(', ')
	}

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className={cn(fieldLabelClassName, 'text-lg')}>
				<CarrotIcon
					size={18}
					weight="duotone"
					aria-hidden
					className="text-kitchen-basil mr-2 inline-block align-middle"
				/>
				ingredients
			</legend>
			<SortableList
				items={rows.map((row) => row.id)}
				describe={describe}
				onMove={(from, to) =>
					setRows((current) => arrayMove(current, from, to))
				}
			>
				<ul className="flex flex-col gap-2">
					{rows.map((row, index) => (
						<SortableRow
							key={row.id}
							id={row.id}
							label={`Reorder ingredient ${index + 1}`}
						>
							{(handle) =>
								row.heading ? (
									<>
										{handle}
										<CarrotIcon
											size={18}
											weight="duotone"
											aria-hidden
											className="text-kitchen-basil shrink-0"
										/>
										<input
											type="hidden"
											name="ingredient"
											value={lineOf(row)}
										/>
										<input
											ref={inputRef(row.id)}
											value={row.text}
											aria-label={`Section heading ${index + 1}`}
											placeholder="for the sauce"
											enterKeyHint="next"
											onChange={(event) =>
												update(row.id, { text: event.target.value })
											}
											onKeyDown={(event) => handleKey(event, row, index)}
											className={cn(
												'border-border focus-visible:outline-kitchen-eggplant min-w-0 flex-1 rounded-md border-b bg-transparent px-1 pt-3 pb-1.5 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2',
												placeholderClassName,
											)}
										/>
										<button
											type="button"
											onClick={() => removeAt(index)}
											aria-label={`Remove section heading ${index + 1}`}
											className={iconButtonClassName}
										>
											<X size={14} weight="bold" aria-hidden />
										</button>
									</>
								) : (
									<>
										{handle}
										<input
											type="hidden"
											name="ingredient"
											value={lineOf(row)}
										/>
										<div className="border-input bg-card focus-within:outline-kitchen-eggplant relative flex min-w-0 flex-1 items-start rounded-xl border group-data-[dragging=true]:border-transparent focus-within:outline-2 focus-within:outline-offset-2">
											<div className="min-w-0 flex-1">
												<IngredientCombobox
													bare
													required={false}
													name="ingredient-line"
													label={`Ingredient ${index + 1}`}
													placeholder={
														index === 0 ? '2 cloves garlic' : 'a knob of butter'
													}
													maxLength={500}
													completion={completion}
													value={row.text}
													onChange={(text) => update(row.id, { text })}
													inputRef={inputRef(row.id)}
													onKeyDown={(event) => handleKey(event, row, index)}
													onPaste={(event) => paste(event, row)}
												/>
											</div>
											<button
												type="button"
												onClick={() => removeAt(index)}
												aria-label={`Remove ingredient ${index + 1}`}
												className={iconButtonClassName}
											>
												<X size={14} weight="bold" aria-hidden />
											</button>
										</div>
									</>
								)
							}
						</SortableRow>
					))}
				</ul>
			</SortableList>
			<div className="ml-10 flex gap-2">
				<button
					type="button"
					onClick={() => insertAfter(rows.length - 1, [''])}
					className={addButtonClassName}
				>
					<Plus size={14} weight="bold" aria-hidden />
					add ingredient
				</button>
				<button
					type="button"
					onClick={addHeading}
					className={addButtonClassName}
				>
					<Plus size={14} weight="bold" aria-hidden />
					add section
				</button>
			</div>
		</fieldset>
	)
}
