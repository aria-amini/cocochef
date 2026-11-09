import { arrayMove } from '@dnd-kit/sortable'
import { CarrotIcon, DotsSixVertical, Plus, X } from '@phosphor-icons/react'
import { Fragment, useEffect, useRef, useState } from 'react'

import {
	listAddClassName,
	listCardClassName,
	ListHeader,
	listRowClassName,
	RowAction,
} from '@/components/arrange-list'
import {
	IngredientCombobox,
	type LineCompletion,
} from '@/components/ingredient-combobox'
import { SortableList, SortableRow } from '@/components/sortable-list'
import { placeholderClassName } from '@/components/ui/input'
import type { PantryCategory } from '@/lib/pantry/model'
import { blocksOf, moveBlock } from '@/lib/recipes/blocks'
import {
	formatIngredientHeading,
	ingredientHeading,
	parseIngredientLine,
} from '@/lib/recipes/ingredient-line'
import type { IngredientCategories } from '@/lib/recipes/model'
import { pastedIngredients } from '@/lib/recipes/paste'
import { cn } from '@/lib/utils/ui'

// An ingredient is the line as the cook wrote it ("a knob of butter"); a
// heading row holds the section's name ("for the sauce").
type Row = {
	id: string
	text: string
	heading?: true | undefined
	// Picked by the cook; without one the group is guessed from the food.
	category?: PantryCategory | undefined
}

const isHeading = (row: Row) => Boolean(row.heading)

function insertRows(rows: Row[], index: number, added: Row[]) {
	return [...rows.slice(0, index), ...added, ...rows.slice(index)]
}

function toRows(lines: string[], categories: IngredientCategories = {}): Row[] {
	return (lines.length ? lines : ['']).map((line): Row => {
		const heading = ingredientHeading(line)

		return heading === undefined
			? { id: crypto.randomUUID(), text: line, category: categories[line] }
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

const headingIcon = (
	<CarrotIcon
		size={16}
		weight="duotone"
		aria-hidden
		className="text-kitchen-basil shrink-0"
	/>
)

// One ingredient per row, written the way it would be on a card: amount, unit
// and food in one line. Enter starts the next row, an empty row backs out, and
// a pasted list splits into rows. Arranging swaps the fields for handles: a
// line moves on its own, and a section moves with its lines. Each row submits
// as one `ingredient` field; read the rows with `getAll`.
export function IngredientListField({
	defaultValue = [],
	defaultCategories,
	onCountChange,
}: {
	defaultValue?: string[] | undefined
	defaultCategories?: IngredientCategories | undefined
	onCountChange?: (count: number) => void
}) {
	const [rows, setRows] = useState(() =>
		toRows(defaultValue, defaultCategories),
	)

	const [arranging, setArranging] = useState(false)
	// The section heading in hand: while it is carried, sections fold to their
	// headings so one moves as a whole.
	const [carrying, setCarrying] = useState<string>()
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

	const written = rows.filter((row) => lineOf(row))

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
		if (!arranging) focusNext.current = rows[Math.max(index - 1, 0)]?.id

		setRows((current) =>
			current.length === 1
				? toRows([])
				: current.filter((_, position) => position !== index),
		)

		// Arranging one row is nothing to arrange.
		if (arranging && rows.length <= 2) setArranging(false)
	}

	// Blank rows have nothing to arrange; the list gets a blank row back when
	// arranging is done, if it has none to type into.
	function toggleArranging() {
		if (arranging) {
			setRows((current) => (current.length ? current : toRows([])))
			setArranging(false)
		} else {
			setRows((current) => current.filter((row) => lineOf(row)))
			setArranging(true)
		}
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
			<legend className="sr-only">ingredients</legend>
			<ListHeader
				title="ingredients"
				icon={
					<CarrotIcon
						size={18}
						weight="duotone"
						aria-hidden
						className="text-kitchen-basil mr-2 inline-block align-middle"
					/>
				}
				arranging={arranging}
				canArrange={written.length >= 2}
				onArrange={toggleArranging}
			/>
			{rows.map((row) => (
				<Fragment key={row.id}>
					<input type="hidden" name="ingredient" value={lineOf(row)} />
					<input
						type="hidden"
						name="ingredient-category"
						value={row.heading ? '' : (row.category ?? '')}
					/>
				</Fragment>
			))}
			{arranging ? (
				<ArrangedIngredients
					rows={rows}
					carrying={carrying}
					describe={describe}
					onCarry={setCarrying}
					onMove={setRows}
					onRemove={removeAt}
				/>
			) : (
				<>
					<ul className={listCardClassName}>
						{rows.map((row, index) => (
							<li
								key={row.id}
								className={cn(
									listRowClassName,
									'group',
									row.heading && index > 0 && 'pt-2',
								)}
							>
								{row.heading ? (
									<>
										<span className="flex h-11 items-center pl-3">
											{headingIcon}
										</span>
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
												'min-w-0 flex-1 bg-transparent px-2 py-2.5 text-base font-bold outline-none',
												placeholderClassName,
											)}
										/>
										<RowAction
											label={`Remove section heading ${index + 1}`}
											onClick={() => removeAt(index)}
										>
											<X size={14} weight="bold" aria-hidden />
										</RowAction>
									</>
								) : (
									<>
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
										<RowAction
											label={`Remove ingredient ${index + 1}`}
											onClick={() => removeAt(index)}
										>
											<X size={14} weight="bold" aria-hidden />
										</RowAction>
									</>
								)}
							</li>
						))}
					</ul>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => insertAfter(rows.length - 1, [''])}
							className={listAddClassName}
						>
							<Plus size={14} weight="bold" aria-hidden />
							add ingredient
						</button>
						<button
							type="button"
							onClick={addHeading}
							className={listAddClassName}
						>
							<Plus size={14} weight="bold" aria-hidden />
							add section
						</button>
					</div>
				</>
			)}
		</fieldset>
	)
}

// The ingredients as lines with handles. A line goes anywhere, in or out of a
// section; a carried heading folds every section to its heading, so a section
// lands between sections, never inside one.
function ArrangedIngredients({
	rows,
	carrying,
	describe,
	onCarry,
	onMove,
	onRemove,
}: {
	rows: Row[]
	carrying: string | undefined
	describe: (id: string) => string
	onCarry: (id: string | undefined) => void
	onMove: (update: (current: Row[]) => Row[]) => void
	onRemove: (index: number) => void
}) {
	const blocks = blocksOf(rows, isHeading)

	const count = (heading: Row) =>
		blocks.find((block) => block.head === heading)?.rows.length ?? 0

	// Lines before the first section stay put while a section is carried.
	const [first] = blocks
	const loose = first && first.head === undefined ? first.rows : []
	const headings = rows.filter(isHeading)
	const sortable = carrying ? headings : rows

	const line = (row: Row, folded: boolean) =>
		row.heading ? (
			<span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 font-bold">
				{headingIcon}
				<span className="truncate">{row.text.trim()}</span>
				{folded ? (
					<span className="text-muted-foreground shrink-0 text-sm font-semibold">
						· {count(row)}
					</span>
				) : null}
			</span>
		) : (
			<span className="min-w-0 flex-1 truncate py-2.5 pl-3 font-medium">
				{row.text.trim()}
			</span>
		)

	return (
		<SortableList
			items={sortable.map((row) => row.id)}
			describe={describe}
			onPickUp={(id) => {
				if (rows.find((row) => row.id === id)?.heading) onCarry(id)
			}}
			onPutDown={() => onCarry(undefined)}
			onMove={(from, to) =>
				onMove((current) => {
					const moving = sortable[from]
					const target = sortable[to]

					if (!moving || !target) return current

					return carrying
						? moveBlock(current, isHeading, moving, target)
						: arrayMove(
								current,
								current.indexOf(moving),
								current.indexOf(target),
							)
				})
			}
			overlay={(id) => {
				const row = rows.find((candidate) => candidate.id === id)

				return row ? (
					<div className="flex items-center">
						{line(row, Boolean(row.heading))}
						<span className="text-muted-foreground grid size-11 place-items-center">
							<DotsSixVertical size={18} weight="bold" aria-hidden />
						</span>
					</div>
				) : null
			}}
		>
			<ul className={listCardClassName} aria-label="arranging ingredients">
				{carrying
					? loose.map((row) => (
							<li key={row.id} className={cn(listRowClassName, 'items-center')}>
								{line(row, false)}
							</li>
						))
					: null}
				{sortable.map((row) => {
					const index = rows.indexOf(row)

					return (
						<SortableRow
							key={row.id}
							id={row.id}
							label={`Reorder ${row.heading ? 'section' : 'ingredient'} ${index + 1}`}
							className={cn(
								listRowClassName,
								row.heading && 'bg-background/40',
							)}
						>
							{(handle) => (
								<>
									{line(row, Boolean(carrying))}
									{carrying ? null : (
										<button
											type="button"
											aria-label={`Remove ${row.heading ? 'section heading' : 'ingredient'} ${index + 1}`}
											onClick={() => onRemove(index)}
											className="text-muted-foreground hover:text-kitchen-tomato grid size-11 shrink-0 place-items-center"
										>
											<X size={14} weight="bold" aria-hidden />
										</button>
									)}
									{handle}
								</>
							)}
						</SortableRow>
					)
				})}
			</ul>
		</SortableList>
	)
}
