import { arrayMove } from '@dnd-kit/sortable'
import { Plus, TextIndent, TextOutdent, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import { fieldLabelClassName } from '@/components/recipe-form'
import { SortableList, SortableRow } from '@/components/sortable-list'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { pastedStepLines } from '@/lib/recipes/paste'
import { formatSubStep, isSubStep } from '@/lib/recipes/step-groups'
import { cn } from '@/lib/utils/ui'

// A sub-step is stored as "- text" under its step; in the editor it is a row
// with `nested` set, and the marker is written back by `stepsFrom`.
type Row = { id: string; text: string; nested: boolean }

type NewRow = { text: string; nested: boolean }

function toRows(lines: NewRow[]): Row[] {
	return (lines.length ? lines : [{ text: '', nested: false }]).map((line) => ({
		id: crypto.randomUUID(),
		...line,
	}))
}

// The first row has nothing above it to nest under.
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
		if (row.nested && index > 0) {
			sub += 1

			return `${number}.${sub}`
		}

		number += 1
		sub = 0

		return String(number)
	})
}

const iconButtonClassName =
	'text-muted-foreground hover:text-foreground grid size-11 shrink-0 place-items-center '

// One step per row, in the order you cook. Enter starts the next step, an empty
// step backs out, a pasted list splits into rows, and the step's number drags
// it to a new place. A row can be indented into a sub-step of the one above.
// Each row submits as a `step` field with a `step-level` beside it; read them
// with `stepsFrom`.
export function StepsField({
	defaultValue = [],
	onCountChange,
}: {
	defaultValue?: string[] | undefined
	onCountChange?: (count: number) => void
}) {
	const [rows, setRows] = useState(() => rowsFromSteps(defaultValue))
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
		focusNext.current = rows[Math.max(index - 1, 0)]?.id

		setRows((current) =>
			current.length === 1
				? toRows([])
				: current.filter((_, position) => position !== index),
		)
	}

	function describe(id: string) {
		const index = rows.findIndex((row) => row.id === id)

		return `step ${labels(rows)[index]}`
	}

	const numbered = labels(rows)

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className={cn(fieldLabelClassName, 'text-lg')}>steps</legend>
			<SortableList
				items={rows.map((row) => row.id)}
				describe={describe}
				onMove={(from, to) =>
					setRows((current) => arrayMove(current, from, to))
				}
			>
				<ol className="flex flex-col gap-2">
					{rows.map((row, index) => (
						<SortableRow
							key={row.id}
							id={row.id}
							label={`Reorder step ${numbered[index]}`}
							grip={
								<span className="text-sm font-semibold tabular-nums">
									{numbered[index]}
								</span>
							}
							className={cn('items-start', row.nested && index > 0 && 'pl-8')}
						>
							{(handle) => (
								<>
									<span className="flex h-12 shrink-0">{handle}</span>
									<textarea
										ref={(node) => {
											if (node) inputs.current.set(row.id, node)
											else inputs.current.delete(row.id)
										}}
										name="step"
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
											fieldClassName,
											'field-sizing-content min-h-12 min-w-0 flex-1 resize-none py-3 leading-snug',
											placeholderClassName,
										)}
									/>
									<input
										type="hidden"
										name="step-level"
										value={row.nested && index > 0 ? '1' : '0'}
									/>
									{index > 0 ? (
										<button
											type="button"
											onClick={() => setNested(row.id, !row.nested)}
											aria-label={
												row.nested
													? `Make step ${numbered[index]} a step`
													: `Make step ${numbered[index]} a sub-step`
											}
											className={cn(iconButtonClassName, 'h-12')}
										>
											{row.nested ? (
												<TextOutdent size={16} weight="bold" aria-hidden />
											) : (
												<TextIndent size={16} weight="bold" aria-hidden />
											)}
										</button>
									) : null}
									<button
										type="button"
										onClick={() => removeAt(index)}
										aria-label={`Remove step ${numbered[index]}`}
										className={cn(iconButtonClassName, 'h-12')}
									>
										<X size={14} weight="bold" aria-hidden />
									</button>
								</>
							)}
						</SortableRow>
					))}
				</ol>
			</SortableList>
			<button
				type="button"
				onClick={() =>
					insertAfter(rows.length - 1, [{ text: '', nested: false }])
				}
				className="border-input text-muted-foreground hover:text-foreground hover:bg-card ml-10 flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-semibold transition-colors"
			>
				<Plus size={14} weight="bold" aria-hidden />
				add step
			</button>
		</fieldset>
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
