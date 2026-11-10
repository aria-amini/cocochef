import { arrayMove } from '@dnd-kit/sortable'
import {
	ArrowUUpLeftIcon,
	CheckIcon,
	MinusIcon,
	Plus,
	SparkleIcon,
	WarningCircleIcon,
	X,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
	foldSummary,
	ListAddRow,
	ListHeader,
	listRowClassName,
	RowAction,
} from '@/components/arrange-list'
import {
	IngredientCombobox,
	type LineCompletion,
} from '@/components/ingredient-combobox'
import { IngredientLineView } from '@/components/ingredient-line-view'
import { IngredientSuggestions } from '@/components/ingredient-suggestions'
import { PantrySprite } from '@/components/pantry-sprite'
import { SortableList, SortableRow } from '@/components/sortable-list'
import { placeholderClassName } from '@/components/ui/input'
import { wantsAmount } from '@/lib/assistant/amounts'
import type { RegroupGroup, RegroupRequest } from '@/lib/assistant/regroup'
import {
	regroupIngredients,
	suggestAmounts,
	suggestSectionLines,
	suggestSectionName,
} from '@/lib/assistant/server'
import type { PantryCategory } from '@/lib/pantry/model'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import {
	type Block,
	blocksOf,
	gatherBlock,
	moveBlockTo,
} from '@/lib/recipes/blocks'
import {
	formatIngredientHeading,
	ingredientHeading,
	amountOf,
	amountUnits,
	formatQuantity,
	parseIngredientLine,
	setAmountUnit,
	settleAmount,
	settledAmount,
	splitIngredientAmount,
	stepAmount,
} from '@/lib/recipes/ingredient-line'
import type { IngredientCategories } from '@/lib/recipes/model'
import { pastedIngredients } from '@/lib/recipes/paste'
import { cn } from '@/lib/utils/ui'
import { useSettled } from '@/lib/utils/use-settled'

// An ingredient is the line as the cook wrote it ("a knob of butter"); a
// heading row names the group under it ("for the sauce").
type Row = {
	id: string
	text: string
	heading?: true | undefined
	// Picked by the cook; without one the group is guessed from the food.
	category?: PantryCategory | undefined
}

const newRow = (text = ''): Row => ({ id: crypto.randomUUID(), text })

function toRows(lines: string[], categories: IngredientCategories = {}): Row[] {
	return lines.map((line): Row => {
		const heading = ingredientHeading(line)

		return heading === undefined
			? { id: crypto.randomUUID(), text: line, category: categories[line] }
			: { id: crypto.randomUUID(), text: heading, heading: true }
	})
}

function lineOf(row: Row) {
	return row.heading ? formatIngredientHeading(row.text) : row.text.trim()
}

const isBlank = (row: Row) => !row.heading && !row.text.trim()

const isHeading = (row: Row) => Boolean(row.heading)

// A list is never empty: a lone blank line waits to be written in.
const orBlank = (rows: Row[]) => (rows.length ? rows : [newRow()])

// Suggestions finish the food's name and leave the amount as typed.
// They wait for the amount to be in: before it there is no food to finish.
const completion: LineCompletion = {
	query: (line) => (settledAmount(line) ? parseIngredientLine(line).name : ''),
	// The name is the line's last words, however they were spaced.
	apply: (line, suggestion) => {
		const words = parseIngredientLine(line).name.split(/\s+/).filter(Boolean)
		const name = new RegExp(`(?:\\S+\\s*){${words.length}}$`)

		return line.replace(name, '') + suggestion
	},
}

// A line that ends in a colon names a group: "for the sauce:".
const namesGroup = (text: string) => /\S:\s*$/.test(text)

// Whether a field's caret is on its first or last visual line, where the up
// and down arrows leave for the row above or below.
function caretAtEdge(
	field: HTMLInputElement | HTMLTextAreaElement,
	up: boolean,
) {
	const at = field.selectionStart ?? 0

	if (field.selectionEnd !== at) return false

	if (up ? at === 0 : at === field.value.length) return true

	const style = getComputedStyle(field)
	const line = Number.parseFloat(style.lineHeight) || 24

	const padding =
		Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)

	return field.scrollHeight - padding < line * 1.5
}

// A grouping on offer, as the rows it would make.
type Proposal = { rows: Row[] }

const sameName = (a: string, b: string) =>
	a.trim().toLowerCase() === b.trim().toLowerCase()

// The written rows regrouped: each group's lines under its name, a name the
// list already has kept as it is. Nothing when the groups miss a line, or would
// leave the list as it was.
function proposalFrom(rows: Row[], groups: RegroupGroup[]) {
	const written = rows.filter((row) => lineOf(row))
	const lines = written.filter((row) => !row.heading)
	const next: Row[] = []

	for (const group of groups) {
		if (group.heading) {
			const name = group.heading

			const head = written.find(
				(row) => row.heading && sameName(row.text, name) && !next.includes(row),
			) ?? { id: crypto.randomUUID(), text: name, heading: true as const }

			next.push(head)
		}

		for (const index of group.lines) {
			const row = written[index]

			if (!row || row.heading || next.includes(row)) return undefined
			next.push(row)
		}
	}

	if (next.filter((row) => !row.heading).length !== lines.length)
		return undefined

	const same =
		next.length === written.length &&
		next.every((row, index) => row === written[index])

	return same ? undefined : { rows: next }
}

// What the card with no name is called until it is named.
const mainSection = 'main ingredients'

const ease = 'cubic-bezier(0.2, 0, 0, 1)'

// Lets each row glide from where it stood, kept in `from`, to where it stands.
// Rows new to the list drop in; moved rows glow for a moment when `glow`.
function glide(list: HTMLElement, from: Map<string, number>, glow: boolean) {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

	const eggplant = getComputedStyle(list).getPropertyValue('--kitchen-eggplant')
	const tint = `color-mix(in oklab, ${eggplant} 16%, transparent)`

	for (const [at, row] of list
		.querySelectorAll<HTMLElement>('[data-row-id]')
		.entries()) {
		const was = from.get(row.dataset.rowId ?? '')

		if (was === undefined) {
			row.animate(
				[
					{ opacity: 0, transform: 'translateY(-6px)' },
					{ opacity: 1, transform: 'none' },
				],
				{
					duration: 450,
					delay: 120 + at * 12,
					easing: ease,
					fill: 'backwards',
				},
			)
			continue
		}

		const by = was - row.getBoundingClientRect().top

		if (Math.abs(by) < 2) continue
		row.animate([{ transform: `translateY(${by}px)` }, { transform: 'none' }], {
			duration: 500,
			delay: at * 14,
			easing: ease,
			fill: 'backwards',
		})

		if (glow)
			row.animate(
				[
					{ backgroundColor: tint },
					{ backgroundColor: tint, offset: 0.35 },
					{ backgroundColor: 'transparent' },
				],
				{ duration: 1600, easing: ease },
			)
	}
}

// The ingredients, written like a note: one line each, amount and food
// together, set out as a printed card until the cook taps in. Enter splits a
// line at the caret, and a line ending in a colon becomes the name of a group.
// Backspace at a line's start joins it to the line above, or turns a group's
// name back into a line. A line moves by the dots beside it. When the steps
// suggest a better grouping, one offer shows it right in the list, to keep or
// put back. Each row submits as one `ingredient` field; read the rows with
// `getAll`.
export function IngredientListField({
	defaultValue = [],
	defaultCategories,
	title,
	steps = [],
	onCountChange,
	onUnnamedChange,
	flagUnnamed = false,
}: {
	defaultValue?: string[] | undefined
	defaultCategories?: IngredientCategories | undefined
	// The recipe's name, which suggests sections to fill in; none without it.
	title?: string | undefined
	// The recipe's steps, which a better grouping comes from.
	steps?: string[] | undefined
	onCountChange?: (count: number) => void
	// How many sections have lines but no name, which keeps the recipe from
	// saving; once saving was tried, `flagUnnamed` marks each of them.
	onUnnamedChange?: (count: number) => void
	flagUnnamed?: boolean
}) {
	const [rows, setRows] = useState(() =>
		orBlank(toRows(defaultValue, defaultCategories)),
	)

	// The grouping on offer, while it is rows in place of the list.
	// A grouping taken from the offer, with the list as it was, to undo it.
	const [applied, setApplied] = useState<{
		before: Row[]
		after: Row[]
		groups: number
	}>()

	const [declined, setDeclined] = useState(false)
	const [folded, setFolded] = useState(false)
	// The line being worked on, whose amount bar shows under it.
	const [inUse, setInUse] = useState<string>()
	// Lines picked by their pictures, to gather into a section or remove.
	const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set())
	// Sections named here, which suggest their lines.
	const [named, setNamed] = useState<ReadonlySet<string>>(() => new Set())
	const sheet = useRef<HTMLDivElement>(null)

	// Where each row stood before the list was swapped, to glide from.
	const glideFrom = useRef<{ tops: Map<string, number>; glow: boolean }>(
		undefined,
	)

	const fields = useRef(
		new Map<string, HTMLInputElement | HTMLTextAreaElement>(),
	)

	// Where the caret goes once the rows have changed.
	const caret = useRef<{ id: string; at: number }>(undefined)

	useLayoutEffect(() => {
		const target = caret.current

		if (!target) return
		caret.current = undefined
		const field = fields.current.get(target.id)
		field?.focus()
		field?.setSelectionRange(target.at, target.at)
	}, [rows])

	useLayoutEffect(() => {
		const from = glideFrom.current

		if (!from || !sheet.current) return
		glideFrom.current = undefined
		glide(sheet.current, from.tops, from.glow)
	}, [rows])

	useEffect(() => {
		onCountChange?.(
			rows.filter((row) => !row.heading && row.text.trim()).length,
		)
	}, [rows, onCountChange])

	// A section with lines needs a name, or its lines would be saved into the
	// section above. One with no lines just goes.
	const needsName = (row: Row) =>
		Boolean(row.heading) &&
		!row.text.trim() &&
		blocksOf(rows, isHeading).some(
			(block) =>
				block.head === row && block.rows.some((line) => !isBlank(line)),
		)

	const unnamed = rows.filter(needsName).length

	useEffect(() => {
		onUnnamedChange?.(unnamed)
	}, [unnamed, onUnnamedChange])

	const fieldRef =
		(id: string) => (node: HTMLInputElement | HTMLTextAreaElement | null) => {
			if (node) fields.current.set(id, node)
			else fields.current.delete(id)
		}

	const change = (next: (current: Row[]) => Row[]) =>
		setRows((current) => orBlank(next(current)))

	function update(id: string, patch: Partial<Row>) {
		change((current) =>
			current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
		)
	}

	// A new line at the end of a card, with the caret in it. A card already
	// ending in a blank line types into that one.
	function addTo(block: Block<Row>) {
		const last = block.rows.at(-1)

		if (last && isBlank(last)) {
			fields.current.get(last.id)?.focus()

			return
		}

		const end = last ?? block.head
		const added = newRow()
		caret.current = { id: added.id, at: 0 }
		change((current) => {
			const at = end ? current.indexOf(end) + 1 : current.length

			return [...current.slice(0, at), added, ...current.slice(at)]
		})
	}

	// An empty card at the end, its name to be written first.
	function addSection() {
		const head: Row = { id: crypto.randomUUID(), text: '', heading: true }
		caret.current = { id: head.id, at: 0 }
		setNamed((current) => new Set(current).add(head.id))
		change((current) => [...current.filter((row) => !isBlank(row)), head])
	}

	// A typed line, its amount shortened once it is finished ("1 tablespoon "
	// becomes "1 tbsp "), with the caret kept where the cook was typing.
	function write(row: Row, text: string) {
		const settled = settleAmount(text)

		if (settled !== text) {
			const at = fields.current.get(row.id)?.selectionStart ?? text.length
			const typed = settledAmount(text)?.length ?? 0
			const shift = text.length - settled.length

			// After the amount, the caret moves back as it shortens; inside it,
			// the caret stays put, within the shorter amount.
			caret.current = {
				id: row.id,
				at: at >= typed ? at - shift : Math.min(at, typed - shift),
			}
		}

		update(row.id, { text: settled })
	}

	// A line changed from the amount bar, the caret kept as far from the end as
	// it was, so it stays in the food while the amount changes.
	function adjust(row: Row, next: string) {
		const field = fields.current.get(row.id)
		const fromEnd = row.text.length - (field?.selectionStart ?? row.text.length)

		caret.current = { id: row.id, at: Math.max(0, next.length - fromEnd) }
		update(row.id, { text: next })
	}

	function remove(id: string) {
		change((current) => current.filter((row) => row.id !== id))
	}

	// A line left blank goes when the cook moves on, unless it is all there is.
	function leave(row: Row) {
		if (isBlank(row))
			window.setTimeout(() => {
				setRows((current) =>
					current.length > 1 &&
					current.some(
						(candidate) => candidate.id === row.id && isBlank(candidate),
					) &&
					document.activeElement !== fields.current.get(row.id)
						? current.filter((candidate) => candidate.id !== row.id)
						: current,
				)
			})
	}

	function pick(id: string) {
		setPicked((current) => {
			const next = new Set(current)

			if (!next.delete(id)) next.add(id)

			return next
		})
	}

	// The picked lines become a section of their own, named next.
	function makeSection() {
		const head: Row = { id: crypto.randomUUID(), text: '', heading: true }
		const chosen = new Set(rows.filter((row) => picked.has(row.id)))

		caret.current = { id: head.id, at: 0 }
		setNamed((current) => new Set(current).add(head.id))
		change((current) => gatherBlock(current, isHeading, chosen, head))
		setPicked(new Set())
	}

	function removePicked() {
		change((current) => current.filter((row) => !picked.has(row.id)))
		setPicked(new Set())
	}

	// Suggested lines go after the last written row, past any blank ones.
	function addSuggested(lines: string[], heading?: string) {
		const added = toRows(
			heading ? [formatIngredientHeading(heading), ...lines] : lines,
		)

		change((current) => {
			const end = current.map((row) => Boolean(lineOf(row))).lastIndexOf(true)

			return [...current.slice(0, end + 1), ...added]
		})
	}

	function handleKey(
		event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
		row: Row,
	) {
		if (event.nativeEvent.isComposing) return

		const field = event.currentTarget
		const start = field.selectionStart ?? 0
		const end = field.selectionEnd ?? start
		const index = rows.indexOf(row)

		if (event.key === 'Enter') {
			event.preventDefault()
			const before = row.text.slice(0, start)
			const after = row.text.slice(end)

			// An empty line has nothing to split off.
			if (!row.heading && !row.text.trim()) return

			const group = !row.heading && namesGroup(before) && !after.trim()
			const next = newRow(after.trimStart())

			caret.current = { id: next.id, at: 0 }
			change((current) =>
				current.flatMap((candidate) =>
					candidate.id === row.id
						? [
								group
									? {
											id: row.id,
											text: before.replace(/:\s*$/, '').trim(),
											heading: true as const,
										}
									: { ...row, text: before.trimEnd() },
								next,
							]
						: [candidate],
				),
			)
		} else if (event.key === 'Backspace' && start === 0 && end === 0) {
			const previous = rows[index - 1]

			if (row.heading) {
				event.preventDefault()
				caret.current = { id: row.id, at: 0 }
				update(row.id, { heading: undefined })
			} else if (previous) {
				event.preventDefault()

				// Two written halves meet at a space, as the words they were.
				const gap =
					previous.text.trim() && row.text.trim() && !/\s$/.test(previous.text)
						? ' '
						: ''

				caret.current = {
					id: previous.id,
					at: previous.text.length + gap.length,
				}
				change((current) =>
					current.flatMap((candidate) =>
						candidate.id === previous.id
							? [{ ...candidate, text: candidate.text + gap + row.text }]
							: candidate.id === row.id
								? []
								: [candidate],
					),
				)
			}
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			const up = event.key === 'ArrowUp'
			const next = rows[index + (up ? -1 : 1)]
			const target = next && fields.current.get(next.id)

			if (!target || !caretAtEdge(field, up)) return
			event.preventDefault()
			target.focus()
			const at = up ? target.value.length : Math.min(start, target.value.length)
			target.setSelectionRange(at, at)
		}
	}

	function paste(event: React.ClipboardEvent<HTMLTextAreaElement>, row: Row) {
		const lines = pastedIngredients(event.clipboardData.getData('text'))

		if (lines.length < 2) return
		event.preventDefault()

		const [first, ...added] = toRows(lines)
		const last = added.at(-1) ?? first

		if (last) caret.current = { id: last.id, at: last.text.length }
		change((current) =>
			current.flatMap((candidate) =>
				candidate.id === row.id && first
					? [{ ...first, id: row.id }, ...added]
					: [candidate],
			),
		)
	}

	function describe(id: string) {
		const index = rows.findIndex((row) => row.id === id)
		const row = rows[index]
		const what = row?.heading ? 'group' : 'ingredient'

		return [`${what} ${index + 1}`, row?.text.trim()].filter(Boolean).join(', ')
	}

	const lines = rows.map(lineOf).filter(Boolean)
	const request: RegroupRequest = { ingredients: lines, steps }
	const requestKey = JSON.stringify(request)
	const settled = useSettled(request, requestKey)

	const regroup = useQuery({
		queryKey: ['ingredient-regroup', settled],
		queryFn: () => regroupIngredients({ data: settled }),
		enabled:
			!declined && settled.steps.length > 0 && settled.ingredients.length > 1,
		staleTime: Number.POSITIVE_INFINITY,
	})

	// The grouping just taken, while the list is still as it left it.
	const taken = applied?.after === rows ? applied : undefined

	// Only an answer about the list as it stands now is offered.
	const offer =
		!declined &&
		!taken &&
		regroup.data?.groups.length &&
		JSON.stringify(settled) === requestKey
			? proposalFrom(rows, regroup.data.groups)
			: undefined

	// Likely amounts for lines written without one, rows faintly to take.
	const bare = rows.flatMap((row) =>
		!row.heading && wantsAmount(row.text) ? [row.text.trim()] : [],
	)

	const amountAsk = { title: title?.trim() ?? '', lines: bare }
	const settledAmounts = useSettled(amountAsk, JSON.stringify(amountAsk))

	const guessed = useQuery({
		queryKey: ['ingredient-amounts', settledAmounts],
		queryFn: () => suggestAmounts({ data: settledAmounts }),
		enabled: settledAmounts.lines.length > 0,
		staleTime: Number.POSITIVE_INFINITY,
	})

	const guesses = new Map(
		settledAmounts.lines.flatMap((line, at) => {
			const amount = guessed.data?.amounts[at]

			return amount ? [[line, amount] as const] : []
		}),
	)

	// A guessed amount sits in the amount column, faint and dashed, and is
	// the line's own amount once tapped.
	const guessFor = (row: Row) => {
		const amount = guesses.get(row.text.trim())

		if (!amount || !wantsAmount(row.text)) return undefined

		return (
			<button
				type="button"
				aria-label={`Use ${amount} for ${row.text.trim()}`}
				onPointerDown={(event) => event.preventDefault()}
				onClick={() => update(row.id, { text: `${amount} ${row.text.trim()}` })}
				className="border-foreground/30 text-muted-foreground hover:text-foreground hover:border-foreground/60 relative z-10 -my-0.5 rounded-md border border-dashed px-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
			>
				{amount}
			</button>
		)
	}

	// Notes where each row stands, then swaps the list for `next`.
	// Rows move to their new places from where they stood; taking a grouping
	// also lights the rows that moved.
	function glideNext(glow: boolean) {
		const tops = new Map<string, number>()

		for (const row of sheet.current?.querySelectorAll<HTMLElement>(
			'[data-row-id]',
		) ?? [])
			tops.set(row.dataset.rowId ?? '', row.getBoundingClientRect().top)

		glideFrom.current = { tops, glow }
	}

	// Taking the offer regroups the list at once; undo puts it back as it was,
	// and the offer stands again, so the two can be compared.
	function apply(proposal: Proposal) {
		glideNext(true)
		setApplied({
			before: rows,
			after: proposal.rows,
			groups: proposal.rows.filter(isHeading).length,
		})
		change(() => proposal.rows)
	}

	function undo() {
		if (!taken) return
		glideNext(false)
		setApplied(undefined)
		change(() => taken.before)
	}

	const field = (row: Row, index: number) =>
		row.heading ? (
			<input
				ref={fieldRef(row.id)}
				value={row.text}
				aria-label={`Section name ${index + 1}`}
				data-needs-name={needsName(row) || undefined}
				aria-invalid={(flagUnnamed && needsName(row)) || undefined}
				aria-describedby={
					flagUnnamed && needsName(row) ? `section-name-${row.id}` : undefined
				}
				size={1}
				placeholder="name it, like spice blend"
				enterKeyHint="next"
				onChange={(event) => update(row.id, { text: event.target.value })}
				onKeyDown={(event) => handleKey(event, row)}
				className={cn(
					'w-full min-w-0 bg-transparent px-3 py-2.5 text-base font-bold outline-none',
					placeholderClassName,
				)}
			/>
		) : (
			<IngredientCombobox
				bare
				required={false}
				name="ingredient-line"
				label={`Ingredient ${index + 1}`}
				placeholder={isBlank(row) ? '2 tbsp miso' : ''}
				maxLength={500}
				completion={completion}
				value={row.text}
				onChange={(text) => write(row, text)}
				inputRef={fieldRef(row.id)}
				onKeyDown={(event) => {
					if (event.key === 'Escape' && picked.size) setPicked(new Set())
					handleKey(event, row)
				}}
				onPaste={(event) => paste(event, row)}
			/>
		)

	const picking = picked.size > 0

	// The food's picture doubles as the way to pick a line: tapped, it turns
	// into a check, and every other line shows where its check would go.
	const pickButton = (row: Row) => {
		const on = picked.has(row.id)
		const look = ingredientItemLook(row.text)

		return (
			<button
				type="button"
				aria-label={`Pick ${row.text.trim()}`}
				aria-pressed={on}
				onPointerDown={(event) => event.preventDefault()}
				onClick={() => pick(row.id)}
				className="group/pick absolute top-0 left-0 z-10 grid h-11 w-12 place-items-center"
			>
				{picking ? (
					<span
						aria-hidden
						className={cn(
							'grid size-6 place-items-center rounded-full border-2 transition-colors',
							on
								? 'bg-kitchen-eggplant border-kitchen-eggplant text-accent-foreground'
								: 'border-foreground/40 bg-card',
						)}
					>
						{on ? <CheckIcon size={14} weight="bold" /> : null}
					</span>
				) : (
					<span
						aria-hidden
						className="group-hover/pick:ring-foreground/30 grid size-7 place-items-center rounded-full ring-2 ring-transparent transition-shadow"
					>
						{look ? <PantrySprite look={look} className="size-6" /> : null}
					</span>
				)}
			</button>
		)
	}

	const sheetRow = (row: Row, handle?: React.ReactNode) => {
		const index = rows.indexOf(row)
		const blank = isBlank(row)

		return (
			<div
				onFocus={() => setInUse(row.id)}
				onBlur={(event) => {
					const holder = event.currentTarget

					// The bar goes a moment later, so a tap below lands before the
					// rows move up.
					window.setTimeout(() => {
						if (!holder.contains(document.activeElement))
							setInUse((current) => (current === row.id ? undefined : current))
					}, 150)
				}}
			>
				<div
					data-row-id={row.id}
					onBlur={() => leave(row)}
					className={cn(
						'group/row relative flex items-stretch transition-colors',
						picked.has(row.id) && 'bg-kitchen-eggplant/10',
						flagUnnamed &&
							needsName(row) &&
							'ring-kitchen-tomato ring-2 ring-inset',
					)}
				>
					{/* The gutter holds the handle, rows while the row is in use. */}
					<span className="relative flex w-7 shrink-0 items-center justify-center pointer-coarse:w-9">
						{handle}
					</span>
					<div className="relative flex min-w-0 flex-1">
						{/* A written line shows as its card face; the field lies over it,
						    unseen, so a tap lands in the field and editing shows the
						    line as typed. */}
						{blank ? null : (
							<RowFace
								row={row}
								guess={guessFor(row)}
								className="group-focus-within/row:hidden"
							/>
						)}
						{row.heading || blank ? null : pickButton(row)}
						<div
							className={cn(
								'relative min-w-0 flex-1',
								// Typing starts where the amount column does.
								!row.heading && '[&_textarea]:relative [&_textarea]:pl-12',
								!blank &&
									'absolute inset-0 opacity-0 group-focus-within/row:relative group-focus-within/row:inset-auto group-focus-within/row:opacity-100 [&_textarea]:h-full group-focus-within/row:[&_textarea]:h-auto',
							)}
						>
							{row.heading ? null : <AmountMark text={row.text} />}
							{field(row, index)}
						</div>
					</div>
					{/* Said in the band itself, so nothing below it moves. */}
					{flagUnnamed && needsName(row) ? (
						<span
							id={`section-name-${row.id}`}
							role="alert"
							className="text-kitchen-tomato mr-1 inline-flex shrink-0 items-center gap-1 self-center text-xs font-bold whitespace-nowrap"
						>
							<WarningCircleIcon size={14} weight="fill" aria-hidden />
							needs a name
						</span>
					) : null}
					{row.heading && !row.text.trim() ? (
						<NameGuess
							title={title ?? ''}
							lines={linesUnder(row)}
							onUse={(name) => update(row.id, { text: name })}
						/>
					) : null}
					{row.heading ? (
						<RowAction
							label={`Remove section ${row.text.trim() || index + 1}`}
							onClick={() => remove(row.id)}
						>
							<X size={14} weight="bold" aria-hidden />
						</RowAction>
					) : blank ? null : (
						<RowAction
							label={`Remove ingredient ${index + 1}`}
							onClick={() => remove(row.id)}
						>
							<X size={14} weight="bold" aria-hidden />
						</RowAction>
					)}
				</div>
				{row.heading || blank || inUse !== row.id ? null : (
					<AmountBar line={row.text} onChange={(next) => adjust(row, next)} />
				)}
			</div>
		)
	}

	const blocks = blocksOf(rows, isHeading)

	// The written lines of a section, to name it from.
	const linesUnder = (head: Row) =>
		(blocks.find((block) => block.head === head)?.rows ?? [])
			.map((row) => row.text.trim())
			.filter(Boolean)

	// Naming the first card, which has no name row yet, gives it one.
	function nameLoose(block: Block<Row>, text: string) {
		const head: Row = { id: crypto.randomUUID(), text, heading: true }
		caret.current = { id: head.id, at: text.length }
		change((current) => {
			const first = block.rows[0]
			const at = first ? current.indexOf(first) : 0

			return [...current.slice(0, at), head, ...current.slice(at)]
		})
	}

	// A section is named by its heading, or by where it stands until it has one.
	const sectionName = (head: Row) =>
		head.text.trim() || `section ${rows.filter(isHeading).indexOf(head) + 1}`

	return (
		<fieldset className="flex min-w-0 flex-col gap-2">
			<legend className="sr-only">ingredients</legend>
			<ListHeader
				title="ingredients"
				fold={{
					folded,
					onFold: () => setFolded((current) => !current),
					summary: foldSummary(
						rows.filter((row) => !row.heading && row.text.trim()).length,
						'ingredient',
						'ingredients',
					),
					preview: (
						<span aria-hidden className="flex shrink-0 -space-x-1.5">
							{rows
								.flatMap((row) => {
									const look = row.heading
										? undefined
										: ingredientItemLook(row.text)

									return look ? [{ id: row.id, look }] : []
								})
								.slice(0, 4)
								.map(({ id, look }) => (
									<span
										key={id}
										className="bg-background ring-card grid size-8 place-items-center rounded-full ring-2"
									>
										<PantrySprite look={look} className="size-5" />
									</span>
								))}
						</span>
					),
				}}
			></ListHeader>
			{/* Folded on a phone, the list stays in the form, out of sight. */}
			<div className={cn('contents', folded && 'max-md:hidden')}>
				<RegroupOffer
					offer={offer}
					taken={taken?.groups}
					onTry={() => offer && apply(offer)}
					onDecline={() => setDeclined(true)}
					onUndo={undo}
				/>
				{picking ? (
					<PickBar
						count={picked.size}
						onMakeSection={makeSection}
						onRemove={removePicked}
						onClear={() => setPicked(new Set())}
					/>
				) : null}
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
				<SortableList
					items={rows.map((row) => row.id)}
					describe={describe}
					onMove={(from, to) =>
						change((current) => {
							const moving = rows[from]
							const target = rows[to]

							if (!moving || !target) return current

							// A section's name carries its whole card, to wherever the
							// card it is dropped in stands.
							if (moving.heading)
								return moveBlockTo(current, isHeading, moving, target)

							return arrayMove(
								current,
								current.indexOf(moving),
								current.indexOf(target),
							)
						})
					}
					overlay={(id) => {
						const row = rows.find((candidate) => candidate.id === id)

						// A section carries its lines, so it says how many.
						const under = row?.heading
							? (blocks
									.find((block) => block.head === row)
									?.rows.filter((line) => !isBlank(line)).length ?? 0)
							: 0

						return row ? (
							<div className="flex pl-7">
								<RowFace row={row}>
									{under ? (
										<span className="text-muted-foreground text-sm font-semibold">
											+{under}
										</span>
									) : null}
								</RowFace>
							</div>
						) : null
					}}
				>
					{/* Each section is a card of its own, ending in a row that adds
					    to it; a section not yet named or filled waits dashed. */}
					<div ref={sheet} className="flex flex-col gap-3">
						{blocks.map((block) => {
							const head = block.head
							const empty = !block.rows.some((row) => !isBlank(row))

							const written = block.rows
								.map((row) => row.text.trim())
								.filter(Boolean)

							return (
								<div key={head?.id ?? 'loose'} className="relative">
									<ul
										aria-label={head ? sectionName(head) : 'ingredient lines'}
										className={cn(
											'divide-border flex flex-col divide-y rounded-xl border',
											head && empty && !head.text.trim()
												? 'border-foreground/30 border-dashed'
												: 'bg-card border-input',
										)}
									>
										{/* A card with no name is the main one: its band reads so,
										    faintly, until the cook names it or takes a guess. */}
										{head ? null : (
											<li
												className={cn(
													listRowClassName,
													'bg-secondary flex items-center',
												)}
											>
												<span
													aria-hidden
													className="w-7 shrink-0 pointer-coarse:w-9"
												/>
												<>
													<input
														aria-label="Section name"
														placeholder={mainSection}
														maxLength={500}
														value=""
														onChange={(event) =>
															nameLoose(block, event.target.value)
														}
														className={cn(
															'w-full min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base font-bold outline-none',
															'placeholder:text-muted-foreground',
														)}
													/>
													{written.length ? (
														<NameGuess
															title={title ?? ''}
															lines={written}
															onUse={(name) => nameLoose(block, name)}
														/>
													) : null}
												</>
											</li>
										)}
										{[...(head ? [head] : []), ...block.rows].map((row) => (
											<SortableRow
												key={row.id}
												id={row.id}
												label={`Move ${describe(row.id)}`}
												className={cn(
													listRowClassName,
													'block',
													// A section's name is its card's title: a tinted band
													// across the top, not another line.
													row.heading && 'bg-secondary',
												)}
												handleClassName={cn(
													'absolute inset-0 size-auto opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-45',
													// A blank line has nothing to carry.
													isBlank(row) && 'hidden',
												)}
											>
												{(handle) => sheetRow(row, handle)}
											</SortableRow>
										))}
										{head ? (
											<SectionLines
												title={title ?? ''}
												section={head.text}
												asked={named.has(head.id)}
												lines={lines}
												onAdd={(added) =>
													change((current) => {
														const end = block.rows.at(-1) ?? head
														const at = current.indexOf(end) + 1

														return [
															...current.slice(0, at),
															...toRows(added),
															...current.slice(at),
														]
													})
												}
											/>
										) : null}
										<ListAddRow
											what="ingredient"
											label={
												head
													? `add ingredient to ${sectionName(head)}`
													: undefined
											}
											onAdd={() => addTo(block)}
										/>
									</ul>
								</div>
							)
						})}
						{/* A new section is a new card, so the way to one is shaped
						    like the card it makes, below the rest. */}
						<button
							type="button"
							onClick={addSection}
							// One empty card at a time: it fills, or goes, before another.
							disabled={blocks.some(
								(block) => !block.rows.some((row) => !isBlank(row)),
							)}
							className="border-foreground/30 text-muted-foreground enabled:hover:text-foreground enabled:hover:border-foreground/50 flex min-h-12 items-center gap-3 rounded-xl border border-dashed px-3 text-left text-sm font-semibold transition-colors disabled:opacity-50"
						>
							<span aria-hidden className="grid size-6 place-items-center">
								<Plus size={14} weight="bold" />
							</span>
							add section
						</button>
					</div>
				</SortableList>
				{title === undefined ? null : (
					<IngredientSuggestions
						title={title}
						lines={lines}
						onAdd={addSuggested}
					/>
				)}
			</div>
		</fieldset>
	)
}

// What to do with the lines picked by their pictures.
function PickBar({
	count,
	onMakeSection,
	onRemove,
	onClear,
}: {
	count: number
	onMakeSection: () => void
	onRemove: () => void
	onClear: () => void
}) {
	return (
		<output className="bg-kitchen-eggplant/10 animate-in fade-in slide-in-from-top-1 sticky top-2 z-20 flex min-h-12 items-center gap-1 rounded-xl py-1 pr-1 pl-1 duration-200">
			<button
				type="button"
				aria-label="stop picking"
				onClick={onClear}
				className="text-muted-foreground hover:text-foreground grid size-10 shrink-0 place-items-center rounded-lg"
			>
				<X size={16} weight="bold" aria-hidden />
			</button>
			<span className="text-kitchen-eggplant min-w-0 flex-1 text-sm font-bold">
				{count} picked
			</span>
			<button
				type="button"
				onClick={onRemove}
				className="text-kitchen-tomato hover:bg-kitchen-tomato/10 min-h-10 rounded-lg px-3 text-sm font-bold transition-colors"
			>
				remove
			</button>
			<button
				type="button"
				onClick={onMakeSection}
				className="bg-kitchen-eggplant text-accent-foreground min-h-10 rounded-lg px-4 text-sm font-extrabold transition-opacity hover:opacity-90"
			>
				make section
			</button>
		</output>
	)
}

// Lines a section just named here could hold, drawn faintly inside it until
// the cook adds them all or waves them off. Nothing shows for a name the
// assistant knows nothing about.
function SectionLines({
	title,
	section,
	asked,
	lines,
	onAdd,
}: {
	title: string
	section: string
	// Only a section the cook named here suggests anything.
	asked: boolean
	lines: string[]
	onAdd: (lines: string[]) => void
}) {
	const request = {
		title: title.trim(),
		section: section.trim(),
		ingredients: lines,
	}

	const settled = useSettled(request, JSON.stringify(request))
	const [done, setDone] = useState<string>()

	const suggestions = useQuery({
		queryKey: ['section-lines', settled],
		queryFn: () => suggestSectionLines({ data: settled }),
		enabled: asked && settled.section.length >= 3,
		staleTime: Number.POSITIVE_INFINITY,
	})

	const found = suggestions.data?.lines ?? []

	if (!asked || !found.length || done === settled.section) return null

	// The foods alone, a few of them, so the offer stays one line.
	const foods = found.map((line) => splitIngredientAmount(line).name)
	const more = foods.length - 3

	return (
		<li className="border-kitchen-eggplant/30 bg-kitchen-eggplant/5 flex min-h-11 items-center gap-2 border-t border-dashed py-1 pr-1 pl-3">
			<SparkleIcon
				size={14}
				weight="fill"
				aria-hidden
				className="text-kitchen-eggplant shrink-0"
			/>
			<span
				aria-label={`suggested for ${settled.section}: ${found.join(', ')}`}
				className="text-foreground/70 min-w-0 flex-1 truncate text-sm"
			>
				{foods.slice(0, 3).join(', ')}
				{more > 0 ? ` +${more}` : ''}
			</span>
			<button
				type="button"
				onClick={() => {
					onAdd(found)
					setDone(settled.section)
				}}
				className="text-kitchen-eggplant hover:bg-kitchen-eggplant/10 min-h-10 shrink-0 rounded-lg px-3 text-sm font-bold transition-colors"
			>
				add {found.length === 1 ? 'it' : found.length}
			</button>
			<button
				type="button"
				aria-label={`No thanks to suggestions for ${settled.section}`}
				onClick={() => setDone(settled.section)}
				className="text-muted-foreground hover:text-foreground grid size-10 shrink-0 place-items-center rounded-lg"
			>
				<X size={14} weight="bold" aria-hidden />
			</button>
		</li>
	)
}

// Quick changes to the amount of the line in use, under it: a step up or
// down in the unit's own sizes, and the unit itself. Each tap rewrites the
// line, so typing still works as before; a press keeps the caret in the line.
function AmountBar({
	line,
	onChange,
}: {
	line: string
	onChange: (line: string) => void
}) {
	const amount = amountOf(line)

	const chip =
		'min-h-9 shrink-0 rounded-lg px-2 text-sm font-bold transition-colors'

	return (
		<div
			role="toolbar"
			aria-label="amount"
			onPointerDown={(event) => event.preventDefault()}
			className="animate-in fade-in flex items-center gap-0.5 overflow-x-auto pr-2 pb-2 pl-2 duration-150 md:pl-9"
		>
			<span className="bg-background flex shrink-0 items-center rounded-lg">
				<button
					type="button"
					aria-label="less"
					disabled={!amount}
					onClick={() => onChange(stepAmount(line, -1))}
					className="hover:bg-kitchen-yolk/40 grid size-9 place-items-center rounded-lg disabled:opacity-30"
				>
					<MinusIcon size={14} weight="bold" aria-hidden />
				</button>
				<output className="min-w-10 text-center text-sm font-bold tabular-nums">
					{amount ? formatQuantity(amount.quantity) : '–'}
				</output>
				<button
					type="button"
					aria-label="more"
					onClick={() => onChange(stepAmount(line, 1))}
					className="hover:bg-kitchen-yolk/40 grid size-9 place-items-center rounded-lg"
				>
					<Plus size={14} weight="bold" aria-hidden />
				</button>
			</span>
			{amountUnits.map((unit) => (
				<button
					key={unit}
					type="button"
					aria-pressed={amount?.unit === unit}
					onClick={() => onChange(setAmountUnit(line, unit))}
					className={cn(
						chip,
						amount?.unit === unit
							? 'bg-kitchen-yolk/60'
							: 'text-muted-foreground hover:text-foreground hover:bg-background',
					)}
				>
					{unit}
				</button>
			))}
		</div>
	)
}

// The amount a line is typed with, marked under the text once it is finished,
// so the cook sees it has been read as the amount. The text over it is the
// field's own; this only paints the mark behind it, letter for letter.
function AmountMark({ text }: { text: string }) {
	const amount = settledAmount(text)

	if (!amount) return null

	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-0 hidden px-3 py-2.5 pl-12 text-base font-medium wrap-break-word whitespace-pre-wrap text-transparent group-focus-within/row:block"
		>
			{/* The mark reaches up, down and left, never right, so the space
			    before the food stays clear. */}
			<span className="bg-kitchen-yolk/45 -ml-0.75 rounded-sm py-0.75 pl-0.75">
				{amount}
			</span>
			{text.slice(amount.length)}
		</span>
	)
}

// A name a section with none could take, from what is in it: a faint chip
// beside the blank name, taken with a tap. Nothing shows without a good guess.
function NameGuess({
	title,
	lines,
	onUse,
}: {
	title: string
	lines: string[]
	onUse: (name: string) => void
}) {
	const request = { title: title.trim(), lines }
	const settled = useSettled(request, JSON.stringify(request))

	const guess = useQuery({
		queryKey: ['section-name', settled],
		queryFn: () => suggestSectionName({ data: settled }),
		enabled: settled.lines.length > 1,
		staleTime: Number.POSITIVE_INFINITY,
	})

	const name = guess.data?.name

	if (!name || settled.lines.length < 2) return null

	return (
		<button
			type="button"
			aria-label={`Name it ${name}`}
			onPointerDown={(event) => event.preventDefault()}
			onClick={() => onUse(name)}
			className="border-kitchen-eggplant/40 text-kitchen-eggplant bg-background hover:bg-kitchen-eggplant/10 mr-2 inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-semibold whitespace-nowrap transition-colors"
		>
			<SparkleIcon size={12} weight="fill" aria-hidden />
			{name}
		</button>
	)
}

// A row as it reads on the recipe: a line set out like a printed card, or a
// group's name in bold. `children` follow the name.
function RowFace({
	row,
	className,
	guess,
	children,
}: {
	row: Row
	className?: string
	guess?: React.ReactNode
	children?: React.ReactNode
}) {
	return row.heading ? (
		<span
			className={cn(
				'flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-base font-bold',
				className,
			)}
		>
			<span className="min-w-0 wrap-break-word">{row.text}</span>
			{children}
		</span>
	) : (
		<IngredientLineView line={row.text} className={className} guess={guess} />
	)
}

// The one offer of a better grouping, and the bar it turns into while the
// grouping is rows in the list.
function RegroupOffer({
	offer,
	taken,
	onTry,
	onDecline,
	onUndo,
}: {
	offer: Proposal | undefined
	// How many sections the grouping just taken made.
	taken: number | undefined
	onTry: () => void
	onDecline: () => void
	onUndo: () => void
}) {
	const sparkle = <SparkleIcon size={16} weight="fill" aria-hidden />

	// Taken, the pill says what changed, with the way to put it back.
	if (taken !== undefined)
		return (
			<div className="animate-in fade-in flex items-center gap-2 duration-300">
				<output className="bg-kitchen-eggplant/10 text-kitchen-eggplant inline-flex min-h-10 items-center rounded-full">
					<span className="inline-flex items-center gap-2 pr-2 pl-3 text-sm font-bold">
						{sparkle}
						organized into {taken} {taken === 1 ? 'section' : 'sections'}
					</span>
					<button
						type="button"
						aria-label="undo"
						onClick={onUndo}
						className="hover:bg-kitchen-eggplant/10 grid min-h-10 w-9 place-items-center rounded-r-full transition-colors"
					>
						<ArrowUUpLeftIcon size={14} weight="bold" aria-hidden />
					</button>
				</output>
			</div>
		)

	if (!offer) return null

	// One pill: the offer, and beside it inside the pill, the way to wave it off.
	return (
		<div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-2 duration-300">
			<span className="bg-kitchen-eggplant/10 text-kitchen-eggplant inline-flex min-h-10 items-center rounded-full">
				<button
					type="button"
					onClick={onTry}
					className="hover:bg-kitchen-eggplant/10 inline-flex min-h-10 items-center gap-2 rounded-l-full pr-2 pl-3 text-sm font-bold transition-colors"
				>
					{sparkle}
					organize
					<span className="text-kitchen-eggplant/70 font-semibold max-sm:hidden">
						by when things go in
					</span>
				</button>
				<button
					type="button"
					aria-label="not now"
					onClick={onDecline}
					className="hover:bg-kitchen-eggplant/10 grid min-h-10 w-9 place-items-center rounded-r-full transition-colors"
				>
					<X size={14} weight="bold" aria-hidden />
				</button>
			</span>
		</div>
	)
}
