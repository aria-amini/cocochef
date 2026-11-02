import { arrayMove } from '@dnd-kit/sortable'
import { Plus, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'

import {
	fieldClassName,
	fieldLabelClassName,
	placeholderClassName,
} from '@/components/recipe-form'
import { SortableList, SortableRow } from '@/components/sortable-list'
import { leadingNumber } from '@/lib/recipes/paste'
import { formFields } from '@/lib/utils/form'
import { cn } from '@/lib/utils/ui'

type Row = { id: string; text: string }

function toRows(lines: string[]): Row[] {
	return (lines.length ? lines : ['']).map((text) => ({
		id: crypto.randomUUID(),
		text,
	}))
}

function pastedSteps(text: string) {
	return text
		.split(/\r?\n/)
		.map((line) => line.replace(leadingNumber, '').trim())
		.filter(Boolean)
}

const iconButtonClassName =
	'text-muted-foreground hover:text-foreground focus-visible:outline-kitchen-eggplant grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2'

// One step per row, in the order you cook. Enter starts the next step, an empty
// step backs out, a pasted list splits into rows, and the step's number drags
// it to a new place. Each row submits as a
// `step` field; read them with `stepsFrom`.
export function StepsField({
	defaultValue = [],
	onCountChange,
}: {
	defaultValue?: string[] | undefined
	onCountChange?: (count: number) => void
}) {
	const [rows, setRows] = useState(() => toRows(defaultValue))
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

	function insertAfter(index: number, lines: string[]) {
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

		return `step ${index + 1}`
	}

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
							label={`Reorder step ${index + 1}`}
							grip={
								<span className="text-sm font-semibold tabular-nums">
									{index + 1}
								</span>
							}
							className="items-start"
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
										aria-label={`Step ${index + 1}`}
										enterKeyHint="next"
										placeholder={
											index === 0 ? 'boil the pasta' : 'stir in the miso'
										}
										onChange={(event) => update(row.id, event.target.value)}
										onKeyDown={(event) => {
											if (event.nativeEvent.isComposing) return

											if (event.key === 'Enter' && !event.shiftKey) {
												event.preventDefault()

												if (row.text.trim()) insertAfter(index, [''])
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
											const lines = pastedSteps(
												event.clipboardData.getData('text'),
											)

											if (lines.length < 2) return
											event.preventDefault()

											const [first = '', ...rest] = lines
											update(row.id, first)
											insertAfter(index, rest)
										}}
										className={cn(
											fieldClassName,
											'field-sizing-content min-h-12 min-w-0 flex-1 resize-none py-3 leading-snug',
											placeholderClassName,
										)}
									/>
									<button
										type="button"
										onClick={() => removeAt(index)}
										aria-label={`Remove step ${index + 1}`}
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
				onClick={() => insertAfter(rows.length - 1, [''])}
				className="border-input text-muted-foreground hover:text-foreground hover:bg-card focus-visible:outline-kitchen-eggplant ml-10 flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				<Plus size={14} weight="bold" aria-hidden />
				add step
			</button>
		</fieldset>
	)
}

export function stepsFrom(form: FormData) {
	return formFields(form, 'step')
}
