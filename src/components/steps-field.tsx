import { arrayMove } from '@dnd-kit/sortable'
import {
	DotsSixVertical,
	Plus,
	TextIndent,
	TextOutdent,
	X,
} from '@phosphor-icons/react'
import { Fragment, useEffect, useRef, useState } from 'react'

import {
	listAddClassName,
	listCardClassName,
	listFieldClassName,
	ListHeader,
	listRowClassName,
	RowAction,
} from '@/components/arrange-list'
import { SortableList, SortableRow } from '@/components/sortable-list'
import { placeholderClassName } from '@/components/ui/input'
import { blocksOf, moveBlock } from '@/lib/recipes/blocks'
import { pastedStepLines } from '@/lib/recipes/paste'
import { formatSubStep, isSubStep } from '@/lib/recipes/step-groups'
import { cn } from '@/lib/utils/ui'

// A sub-step is stored as "- text" under its step; in the editor it is a row
// with `nested` set, and the marker is written back by `stepsFrom`.
type Row = { id: string; text: string; nested: boolean }

type NewRow = { text: string; nested: boolean }

// The first row has nothing above it to nest under.
const isSub = (row: Row, index: number) => row.nested && index > 0

const isStep = (row: Row, index: number) => !isSub(row, index)

function toRows(lines: NewRow[]): Row[] {
	return (lines.length ? lines : [{ text: '', nested: false }]).map((line) => ({
		id: crypto.randomUUID(),
		...line,
	}))
}

function rowsFromSteps(steps: string[]) {
	return toRows(
		steps.map((step, index) => ({
			text: isSubStep(step) ? step.trim().replace(/^-\s+/, '') : step,
			nested: index > 0 && isSubStep(step),
		})),
	)
}

// "3" for a step and "3.2" for the second sub-step of step 3, as on the page.
function labels(rows: Row[]) {
	let number = 0
	let sub = 0

	return rows.map((row, index) => {
		if (isSub(row, index)) {
			sub += 1

			return `${number}.${sub}`
		}

		number += 1
		sub = 0

		return String(number)
	})
}

const numberClassName =
	'text-muted-foreground w-9 shrink-0 text-right text-sm font-semibold tabular-nums'

// One step per row, in the order you cook. Enter starts the next step, an empty
// step backs out, and a pasted list splits into rows. A row can be indented
// into a sub-step of the one above. Arranging swaps the fields for handles: a
// step moves with its sub-steps, and a sub-step moves on its own. Each row
// submits as a `step` field with a `step-level` beside it; read them with
// `stepsFrom`.
export function StepsField({
	defaultValue = [],
	onCountChange,
}: {
	defaultValue?: string[] | undefined
	onCountChange?: (count: number) => void
}) {
	const [rows, setRows] = useState(() => rowsFromSteps(defaultValue))
	const [arranging, setArranging] = useState(false)
	const inputs = useRef(new Map<string, HTMLTextAreaElement>())
	const focusNext = useRef<string>(undefined)

	useEffect(() => {
		if (!focusNext.current) return
		inputs.current.get(focusNext.current)?.focus()
		focusNext.current = undefined
	}, [rows])

	useEffect(() => {
		onCountChange?.(rows.filter((row) => row.text.trim()).length)
	}, [rows, onCountChange])

	function update(id: string, text: string) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, text } : row)),
		)
	}

	function setNested(id: string, nested: boolean) {
		setRows((current) =>
			current.map((row) => (row.id === id ? { ...row, nested } : row)),
		)
	}

	function insertAfter(index: number, lines: NewRow[]) {
		const added = toRows(lines)
		focusNext.current = added.at(-1)?.id
		setRows((current) => [
			...current.slice(0, index + 1),
			...added,
			...current.slice(index + 1),
		])
	}

	function removeAt(index: number) {
		if (!arranging) focusNext.current = rows[Math.max(index - 1, 0)]?.id

		setRows((current) =>
			current.length === 1
				? toRows([])
				: current.filter((_, position) => position !== index),
		)

		if (arranging && rows.length <= 2) setArranging(false)
	}

	function toggleArranging() {
		if (arranging) {
			setRows((current) => (current.length ? current : toRows([])))
			setArranging(false)
		} else {
			setRows((current) => current.filter((row) => row.text.trim()))
			setArranging(true)
		}
	}

	const numbered = labels(rows)

	function describe(id: string) {
		const index = rows.findIndex((row) => row.id === id)

		return `step ${numbered[index]}`
	}

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="sr-only">steps</legend>
			<ListHeader
				title="steps"
				arranging={arranging}
				canArrange={rows.filter((row) => row.text.trim()).length >= 2}
				onArrange={toggleArranging}
			/>
			{rows.map((row, index) => (
				<Fragment key={row.id}>
					<input type="hidden" name="step" value={row.text} />
					<input
						type="hidden"
						name="step-level"
						value={isSub(row, index) ? '1' : '0'}
					/>
				</Fragment>
			))}
			{arranging ? (
				<ArrangedSteps
					rows={rows}
					numbered={numbered}
					describe={describe}
					onMove={setRows}
					onRemove={removeAt}
				/>
			) : (
				<>
					<ol className={listCardClassName}>
						{rows.map((row, index) => (
							<li
								key={row.id}
								className={cn(
									listRowClassName,
									'group',
									isSub(row, index) && 'pl-8',
								)}
							>
								<span className={cn(numberClassName, 'pt-3')}>
									{numbered[index]}
								</span>
								<textarea
									ref={(node) => {
										if (node) inputs.current.set(row.id, node)
										else inputs.current.delete(row.id)
									}}
									rows={1}
									value={row.text}
									aria-label={`Step ${numbered[index]}`}
									enterKeyHint="next"
									placeholder={
										index === 0 ? 'boil the pasta' : 'stir in the miso'
									}
									onChange={(event) => update(row.id, event.target.value)}
									onKeyDown={(event) => {
										if (event.nativeEvent.isComposing) return

										if (event.key === 'Enter' && !event.shiftKey) {
											event.preventDefault()

											if (row.text.trim())
												insertAfter(index, [{ text: '', nested: row.nested }])
										} else if (
											event.key === 'Backspace' &&
											!row.text &&
											rows.length > 1
										) {
											event.preventDefault()
											removeAt(index)
										}
									}}
									onPaste={(event) => {
										const lines = pastedStepLines(
											event.clipboardData.getData('text'),
										)

										if (lines.length < 2) return
										event.preventDefault()

										const [first, ...rest] = lines
										update(row.id, first?.text ?? '')
										insertAfter(index, rest)
									}}
									className={cn(
										listFieldClassName,
										'field-sizing-content min-h-11 leading-snug',
										placeholderClassName,
									)}
								/>
								{index > 0 ? (
									<RowAction
										label={
											row.nested
												? `Make step ${numbered[index]} a step`
												: `Make step ${numbered[index]} a sub-step`
										}
										onClick={() => setNested(row.id, !row.nested)}
									>
										{row.nested ? (
											<TextOutdent size={16} weight="bold" aria-hidden />
										) : (
											<TextIndent size={16} weight="bold" aria-hidden />
										)}
									</RowAction>
								) : null}
								<RowAction
									label={`Remove step ${numbered[index]}`}
									onClick={() => removeAt(index)}
								>
									<X size={14} weight="bold" aria-hidden />
								</RowAction>
							</li>
						))}
					</ol>
					<button
						type="button"
						onClick={() =>
							insertAfter(rows.length - 1, [{ text: '', nested: false }])
						}
						className={listAddClassName}
					>
						<Plus size={14} weight="bold" aria-hidden />
						add step
					</button>
				</>
			)}
		</fieldset>
	)
}

// The steps with handles. A sub-step goes anywhere; a carried step folds every
// step to itself, so it lands with its sub-steps between steps.
function ArrangedSteps({
	rows,
	numbered,
	describe,
	onMove,
	onRemove,
}: {
	rows: Row[]
	numbered: string[]
	describe: (id: string) => string
	onMove: (update: (current: Row[]) => Row[]) => void
	onRemove: (index: number) => void
}) {
	const [carrying, setCarrying] = useState<string>()
	const blocks = blocksOf(rows, isStep)
	const steps = rows.filter(isStep)
	const sortable = carrying ? steps : rows

	const count = (step: Row) =>
		blocks.find((block) => block.head === step)?.rows.length ?? 0

	const line = (row: Row, folded: boolean) => {
		const index = rows.indexOf(row)

		return (
			<span
				className={cn(
					'flex min-w-0 flex-1 items-baseline gap-0 py-2.5',
					!folded && isSub(row, index) && 'pl-8',
				)}
			>
				<span className={numberClassName}>{numbered[index]}</span>
				<span className="line-clamp-2 min-w-0 flex-1 px-3 font-medium">
					{row.text.trim()}
				</span>
				{folded && count(row) ? (
					<span className="text-muted-foreground shrink-0 text-sm font-semibold">
						+{count(row)}
					</span>
				) : null}
			</span>
		)
	}

	return (
		<SortableList
			items={sortable.map((row) => row.id)}
			describe={describe}
			onPickUp={(id) => {
				const index = rows.findIndex((row) => row.id === id)
				const row = rows[index]

				// A step with sub-steps takes them along.
				if (
					row &&
					isStep(row, index) &&
					blocks.some((block) => block.rows.length)
				)
					setCarrying(id)
			}}
			onPutDown={() => setCarrying(undefined)}
			onMove={(from, to) =>
				onMove((current) => {
					const moving = sortable[from]
					const target = sortable[to]

					if (!moving || !target) return current

					return carrying
						? moveBlock(current, isStep, moving, target)
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
						{line(row, Boolean(carrying))}
						<span className="text-muted-foreground grid size-11 place-items-center">
							<DotsSixVertical size={18} weight="bold" aria-hidden />
						</span>
					</div>
				) : null
			}}
		>
			<ol className={listCardClassName} aria-label="arranging steps">
				{sortable.map((row) => {
					const index = rows.indexOf(row)

					return (
						<SortableRow
							key={row.id}
							id={row.id}
							label={`Reorder step ${numbered[index]}`}
							className={listRowClassName}
						>
							{(handle) => (
								<>
									{line(row, Boolean(carrying))}
									{carrying ? null : (
										<button
											type="button"
											aria-label={`Remove step ${numbered[index]}`}
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
			</ol>
		</SortableList>
	)
}

export function stepsFrom(form: FormData) {
	const levels = form.getAll('step-level').map(String)

	return form
		.getAll('step')
		.map(String)
		.flatMap((value, index) => {
			const text = value.trim()

			if (!text) return []

			return levels[index] === '1' ? [formatSubStep(text)] : [text]
		})
}
