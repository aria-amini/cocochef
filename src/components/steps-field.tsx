import { arrayMove } from '@dnd-kit/sortable'
import { TextIndent, TextOutdent, X } from '@phosphor-icons/react'
import { Fragment, useEffect, useRef, useState } from 'react'

import {
	foldSummary,
	ListAddRow,
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
// into a sub-step of the one above. Every written row has a handle in its
// gutter, always: a carried step folds the list to steps and takes its
// sub-steps along, and a sub-step moves on its own. Each row submits as a
// `step` field with a `step-level` beside it; read them with `stepsFrom`.
export function StepsField({
	defaultValue = [],
	lit,
	onCountChange,
	onStepsChange,
}: {
	defaultValue?: string[] | undefined
	// A stored step to light up, such as the one a group of ingredients goes
	// into.
	lit?: number | undefined
	onCountChange?: (count: number) => void
	// The steps as they would be saved.
	onStepsChange?: (steps: string[]) => void
}) {
	const [rows, setRows] = useState(() => rowsFromSteps(defaultValue))
	const [carrying, setCarrying] = useState<string>()
	const [folded, setFolded] = useState(false)
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

	useEffect(() => {
		onStepsChange?.(stored(rows))
	}, [rows, onStepsChange])

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

	// A step left blank goes when the cook moves on, unless it is all there is.
	function leave(row: Row) {
		if (row.text.trim()) return
		window.setTimeout(() => {
			setRows((current) =>
				current.length > 1 &&
				current.some(
					(candidate) => candidate.id === row.id && !candidate.text.trim(),
				) &&
				document.activeElement !== inputs.current.get(row.id)
					? current.filter((candidate) => candidate.id !== row.id)
					: current,
			)
		})
	}

	const numbered = labels(rows)
	const blocks = blocksOf(rows, isStep)
	const steps = rows.filter(isStep)
	// While a step is carried, the list folds to steps.
	const sortable = carrying ? steps : rows

	const count = (step: Row) =>
		blocks.find((block) => block.head === step)?.rows.length ?? 0

	// Where each row is in the saved list; blank rows are not saved.
	const places = rows.map(
		(_, index) =>
			rows.slice(0, index).filter((before) => before.text.trim()).length,
	)

	function describe(id: string) {
		const index = rows.findIndex((row) => row.id === id)

		return `step ${numbered[index]}`
	}

	// A step as it reads, for the one in hand and the folded list under it.
	const face = (row: Row) => {
		const index = rows.indexOf(row)

		return (
			<span className="flex min-w-0 flex-1 items-baseline py-2.5 pl-7">
				<span className={numberClassName}>{numbered[index]}</span>
				<span className="line-clamp-2 min-w-0 flex-1 px-3 font-medium">
					{row.text.trim()}
				</span>
				{carrying && count(row) ? (
					<span className="text-muted-foreground shrink-0 pr-3 text-sm font-semibold">
						+{count(row)}
					</span>
				) : null}
			</span>
		)
	}

	const field = (row: Row, index: number) => (
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
				// Only the first and last say what goes there.
				index === 0
					? 'boil the pasta'
					: index === rows.length - 1
						? 'what comes next'
						: ''
			}
			onChange={(event) => update(row.id, event.target.value)}
			onBlur={() => leave(row)}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return

				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault()

					if (row.text.trim())
						insertAfter(index, [{ text: '', nested: row.nested }])
				} else if (event.key === 'Backspace' && !row.text && rows.length > 1) {
					event.preventDefault()
					removeAt(index)
				}
			}}
			onPaste={(event) => {
				const lines = pastedStepLines(event.clipboardData.getData('text'))

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
	)

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="sr-only">steps</legend>
			<ListHeader
				title="steps"
				fold={{
					folded,
					onFold: () => setFolded((current) => !current),
					summary: foldSummary(
						rows.filter((row) => row.text.trim()).length,
						'step',
						'steps',
					),
				}}
			/>
			{/* Folded on a phone, the list stays in the form, out of sight. */}
			<div className={cn('contents', folded && 'max-md:hidden')}>
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
						setRows((current) => {
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

						return row ? <div className="flex">{face(row)}</div> : null
					}}
				>
					<ol className={listCardClassName}>
						{sortable.map((row) => {
							const index = rows.indexOf(row)
							const blank = !row.text.trim()

							return (
								<SortableRow
									key={row.id}
									id={row.id}
									label={`Move step ${numbered[index]}`}
									className={cn(
										listRowClassName,
										'group/row transition-colors',
										!carrying && isSub(row, index) && 'pl-8',
										lit !== undefined &&
											!blank &&
											places[index] === lit &&
											'bg-kitchen-eggplant/10',
									)}
									handleClassName={cn(
										'absolute inset-0 size-auto opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-45',
										// A blank step has nothing to carry.
										blank && 'hidden',
									)}
								>
									{(handle) =>
										carrying ? (
											<span className="relative flex min-w-0 flex-1">
												<span className="absolute inset-y-0 left-0 w-7">
													{handle}
												</span>
												{face(row)}
											</span>
										) : (
											<>
												{/* The gutter holds the handle. */}
												<span className="relative w-7 shrink-0 self-stretch pointer-coarse:w-9">
													{handle}
												</span>
												<span className={cn(numberClassName, 'w-6 pt-3')}>
													{numbered[index]}
												</span>
												{field(row, index)}
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
															<TextOutdent
																size={16}
																weight="bold"
																aria-hidden
															/>
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
											</>
										)
									}
								</SortableRow>
							)
						})}
						{carrying ? null : (
							<ListAddRow
								what="step"
								onAdd={() => {
									const last = rows.at(-1)

									// Types into a blank last step rather than stacking another.
									if (last && !last.text.trim())
										inputs.current.get(last.id)?.focus()
									else
										insertAfter(rows.length - 1, [{ text: '', nested: false }])
								}}
							/>
						)}
					</ol>
				</SortableList>
			</div>
		</fieldset>
	)
}

// The rows as they are saved: blank ones dropped, sub-steps marked.
function stored(rows: Row[]) {
	return rows.flatMap((row, index) => {
		const text = row.text.trim()

		if (!text) return []

		return isSub(row, index) ? [formatSubStep(text)] : [text]
	})
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
