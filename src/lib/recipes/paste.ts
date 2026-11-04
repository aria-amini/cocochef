import {
	formatIngredientHeading,
	parseIngredientLine,
} from '@/lib/recipes/ingredient-line'
import { clampRecipeTitle } from '@/lib/recipes/model'
import { formatSubStep } from '@/lib/recipes/step-groups'

export type PastedRecipe = {
	title: string
	ingredients: string[]
	steps: string[]
	// Equipment and tips found in the paste, for the notes.
	notes?: string
}

type Section = 'ingredients' | 'steps' | 'equipment' | 'notes'

const ingredientsHeading =
	/^(?:ingredients?|groceries|shopping list|what you(?:'|’)?ll need|you(?:'|’)?ll need)$/i

const stepsHeading =
	/^(?:method|directions?|instructions?|steps?|preparation|prep|how to make(?: it)?)$/i

// "Rice Instructions" is a method too, though "Rice" alone is not a heading.
const stepsHeadingEnd = /\b(?:instructions?|directions?|method)$/i

const equipmentHeading =
	/^(?:equipment|tools|utensils|kitchen tools|special equipment)$/i

const notesHeading = /^(?:notes?|tips?|storage|serving suggestions?)$/i

// A pasted method often arrives numbered ("1. boil", "step 2: stir"); the row
// number already says that. The space after it keeps "1.5 hours" whole.
// A dash before another digit is a range ("2 - 3 cloves"), not a separator.
export const leadingNumber = /^\s*(?:step\s*)?\d+\s*(?:[.):]\s+|-\s+(?!\d))/i

// A checklist copied from a notes app arrives as "- [x] 2 eggs"; the box says
// nothing about the food.
export const bullet = /^\s*[-•*–·▢□]\s*(?:\[[ xX]\]\s*)?/

// "for the sauce:" inside an ingredient list names a group, not a food.
const groupLabel = /^(?:for (?:the )?)?[^\d:]{1,40}:$/i

// A line as it goes on the ingredient list: without its bullet, and a group
// label ("for the sauce:") as a section heading.
function ingredientFromPaste(line: string) {
	const item = line.trim().replace(bullet, '')

	return groupLabel.test(item)
		? formatIngredientHeading(item.replace(/:$/, ''))
		: item
}

// A list pasted into the ingredients, one line per row.
export function pastedIngredients(text: string) {
	return text.split(/\r?\n/).map(ingredientFromPaste).filter(Boolean)
}

// Starts with an amount, or is short enough to be one on a list.
function looksLikeIngredient(line: string) {
	if (parseIngredientLine(line).quantity !== undefined) return true

	return line.length <= 40 && !/[.!?]$/.test(line)
}

// ===== Reading the lines =====

type PastedLine = {
	kind: 'blank' | 'number' | 'bullet' | 'plain'
	// Without its number, bullet or checkbox.
	text: string
	indent: number
}

function readLine(raw: string): PastedLine {
	const expanded = raw.replaceAll('\t', '    ')
	const trimmed = expanded.trim()
	const indent = expanded.length - expanded.trimStart().length

	if (!trimmed) return { kind: 'blank', text: '', indent: 0 }

	if (leadingNumber.test(trimmed))
		return { kind: 'number', text: trimmed.replace(leadingNumber, ''), indent }

	if (bullet.test(trimmed))
		return { kind: 'bullet', text: trimmed.replace(bullet, ''), indent }

	return { kind: 'plain', text: trimmed, indent }
}

// "Prep (Do ahead of time)" and "Optional: Rice Instructions (1 hour before)"
// are headings; "Serve with rice." is not.
function headingOf(line: PastedLine) {
	if (line.kind !== 'plain' || line.text.length > 100) return undefined

	if (/[.!?]$/.test(line.text)) return undefined
	const optional = /^optional\b[:\s-]*/i.test(line.text)

	const core = line.text
		.replace(/^optional\b[:\s-]*/i, '')
		.replace(/\s*\(.*\)\s*$/, '')
		.replace(/:$/, '')
		.trim()

	let section: Section | undefined

	if (core.length > 40) return undefined

	if (ingredientsHeading.test(core)) section = 'ingredients'
	else if (stepsHeading.test(core) || stepsHeadingEnd.test(core))
		section = 'steps'
	else if (equipmentHeading.test(core)) section = 'equipment'
	else if (notesHeading.test(core)) section = 'notes'

	return section ? { section, optional } : undefined
}

// A short label over a list ("Herbs", "Sides (Optional)") names a group, not a
// food: it has no amount and is followed by bullets, or ends with a colon.
function isGroupHeading(line: PastedLine, next: PastedLine | undefined) {
	if (line.kind !== 'plain' || line.text.length > 40) return false

	if (line.text.split(/\s+/).length > 5 || /[.!?,]$/.test(line.text))
		return false

	if (parseIngredientLine(line.text).quantity !== undefined) return false

	return (
		next !== undefined &&
		next.kind !== 'blank' &&
		(line.text.endsWith(':') || next.kind === 'bullet')
	)
}

function withoutEmoji(text: string) {
	return text.replaceAll(/\p{Extended_Pictographic}️?/gu, '').trim()
}

// ===== Parsing =====

// A recipe copied from a note, a message or a page, as plain lines. Section
// headings ("ingredients", "groceries", "instructions", "equipment") split it
// when present; groups inside a list stay groups, numbered steps keep the
// sub-steps indented under them, and equipment goes to the notes. Without
// headings each line is sorted by whether it reads like an amount or an
// instruction. The first line names the recipe unless it is a heading.
export function parsePastedRecipe(text: string): PastedRecipe {
	const lines = text.split(/\r?\n/).map(readLine)
	const first = lines.findIndex((line) => line.kind !== 'blank')

	let title = ''

	if (first !== -1) {
		const line = lines[first]

		if (line && !headingOf(line)) {
			title = withoutEmoji(line.text)
			lines[first] = { kind: 'blank', text: '', indent: 0 }
		}
	}

	const ingredients: string[] = []
	const steps: string[] = []
	const equipment: { label: string | undefined; items: string[] }[] = []
	const notes: string[] = []

	let section: Section | undefined
	let optional = false
	// The indent the current method's top-level steps sit at.
	let stepIndent: number | undefined
	let inStep = false

	for (const [index, line] of lines.entries()) {
		if (line.kind === 'blank') continue
		const heading = headingOf(line)

		if (heading) {
			section = heading.section
			optional = heading.optional
			stepIndent = undefined
			inStep = false

			if (section === 'equipment')
				equipment.push({ label: undefined, items: [] })

			continue
		}

		const next = lines
			.slice(index + 1)
			.find((candidate) => candidate.kind !== 'blank')

		if (section === 'equipment') {
			const group = equipment.at(-1)

			if (!group) continue

			if (isGroupHeading(line, next)) {
				equipment.push({ label: line.text.replace(/:$/, ''), items: [] })
				continue
			}

			group.items.push(line.text)
			continue
		}

		if (section === 'notes') {
			notes.push(line.text)
			continue
		}

		if (section === 'ingredients') {
			if (
				isGroupHeading(line, next) ||
				(line.kind === 'plain' && groupLabel.test(line.text))
			)
				ingredients.push(formatIngredientHeading(line.text.replace(/:$/, '')))
			else ingredients.push(line.text)

			continue
		}

		// Everything else is a method, or a paste with no headings yet.
		const isStep =
			section === 'steps' ||
			line.kind === 'number' ||
			(line.kind === 'plain' && !looksLikeIngredient(line.text))

		if (!isStep) {
			if (isGroupHeading(line, next) || groupLabel.test(line.text))
				ingredients.push(formatIngredientHeading(line.text.replace(/:$/, '')))
			else ingredients.push(line.text)

			continue
		}

		stepIndent ??= line.indent

		if (line.indent > stepIndent && inStep) steps.push(formatSubStep(line.text))
		else {
			steps.push(optional ? `${line.text} (optional)` : line.text)
			inStep = true
		}
	}

	// A group in the equipment whose items have amounts is ingredients that
	// were filed under it ("Spices/Dry herbs: 1 teaspoon fenugreek").
	const tools: string[] = []
	const measuredLines: string[] = []

	for (const { label, items } of equipment) {
		const measured = items.filter(
			(item) => parseIngredientLine(item).quantity !== undefined,
		)

		if (items.length && measured.length * 2 >= items.length) {
			measuredLines.push(
				...(label ? [formatIngredientHeading(label)] : []),
				...items,
			)
		} else tools.push(...items)
	}

	ingredients.unshift(...measuredLines)

	const noteLines = [
		...(tools.length ? [`Equipment: ${tools.join(', ')}`] : []),
		...notes,
	]

	const recipe: PastedRecipe = {
		title: clampRecipeTitle(title),
		ingredients,
		steps,
	}

	if (noteLines.length) recipe.notes = noteLines.join('\n')

	return recipe
}

// A list pasted into a step: one step per line, and a line indented deeper
// than the first is a sub-step of the step above it.
export function pastedStepLines(text: string) {
	let base: number | undefined

	return text.split(/\r?\n/).flatMap((raw) => {
		const line = readLine(raw)

		if (line.kind === 'blank') return []
		base ??= line.indent

		return [{ text: line.text, nested: line.indent > base }]
	})
}

// Worth parsing: more than a name on one line.
export function isPastedRecipe(text: string) {
	return text.trim().includes('\n')
}
