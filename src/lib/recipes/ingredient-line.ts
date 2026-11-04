export type IngredientParts = {
	quantity: number | undefined
	unit: string
	name: string
}

// ===== Units =====

// `value` is what the line stores. `aliases` are the spellings that notes and
// typed lines use for it.
const ingredientUnits = [
	{ value: 'tsp', aliases: ['tsp', 'teaspoon', 'teaspoons'] },
	{ value: 'tbsp', aliases: ['tbsp', 'tablespoon', 'tablespoons'] },
	{ value: 'cup', aliases: ['cup', 'cups'] },
	{ value: 'g', aliases: ['g', 'gram', 'grams'] },
	{ value: 'kg', aliases: ['kg', 'kilogram', 'kilograms'] },
	{ value: 'ml', aliases: ['ml', 'milliliter', 'milliliters'] },
	{ value: 'l', aliases: ['l', 'liter', 'liters', 'litre', 'litres'] },
	{ value: 'oz', aliases: ['oz', 'ounce', 'ounces'] },
	{ value: 'lb', aliases: ['lb', 'lbs', 'pound', 'pounds'] },
	{ value: 'clove', aliases: ['clove', 'cloves'] },
	{ value: 'pinch', aliases: ['pinch', 'pinches'] },
	{ value: 'can', aliases: ['can', 'cans'] },
	{ value: 'bunch', aliases: ['bunch', 'bunches'] },
] as const

const unitByAlias = new Map<string, string>(
	ingredientUnits.flatMap((unit) =>
		unit.aliases.map((alias) => [alias, unit.value] as const),
	),
)

// ===== Quantity =====

const FRACTIONS = new Map([
	['¼', 0.25],
	['½', 0.5],
	['¾', 0.75],
	['⅓', 1 / 3],
	['⅔', 2 / 3],
	['⅛', 0.125],
])

const FRACTION_GLYPHS = [...FRACTIONS.keys()].join('')

function quantityFrom(text: string) {
	let total = 0

	for (const part of text.trim().split(/\s+/)) {
		const fraction = /^(\d+)\/(\d+)$/.exec(part)
		const mixed = new RegExp(`^(\\d*)([${FRACTION_GLYPHS}])$`).exec(part)

		if (fraction) total += Number(fraction[1]) / Number(fraction[2])
		else if (mixed)
			total += Number(mixed[1] || 0) + (FRACTIONS.get(mixed[2] ?? '') ?? 0)
		else total += Number(part)
	}

	return Number.isFinite(total) && total > 0 ? total : undefined
}

// ===== Lines =====

const QUANTITY = `\\d+\\s+[${FRACTION_GLYPHS}]|\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+[${FRACTION_GLYPHS}]?|[${FRACTION_GLYPHS}]`

// A quantity ends at a space, a letter ("200g") or a bracket, so "2-3 eggs" and
// "100% cocoa" stay as written.
const LINE = new RegExp(`^(${QUANTITY})(?=[\\s\\p{L}(]|$)\\s*(.*)$`, 'u')

export function parseIngredientLine(line: string): IngredientParts {
	const text = line.trim()
	const match = LINE.exec(text)
	const quantity = match?.[1] ? quantityFrom(match[1]) : undefined

	if (!match || quantity === undefined)
		return { quantity: undefined, unit: '', name: text }

	const [first = '', ...rest] = (match[2] ?? '').split(/\s+/)
	const unit = unitByAlias.get(first.toLowerCase().replace(/\.$/, ''))

	return unit
		? { quantity, unit, name: rest.join(' ') }
		: { quantity, unit: '', name: (match[2] ?? '').trim() }
}

// An alternate measure after the first one ("12oz / 340g spinach").
const ALTERNATE = new RegExp(
	`^/\\s*(?:${QUANTITY})(?=[\\s\\p{L}(]|$)\\s*(.*)$`,
	'u',
)

function takeUnit(text: string) {
	const [first = '', ...rest] = text.split(/\s+/)

	return unitByAlias.has(first.toLowerCase().replace(/\.$/, ''))
		? { unit: first, rest: rest.join(' ') }
		: { unit: '', rest: text }
}

// Splits a line into the amount ("1 ½ tablespoons") and the rest, for layouts
// that give each its own column. A second measure ("/ 340g") moves to the end
// of the name.
export function splitIngredientAmount(line: string) {
	const text = line.trim()
	const match = LINE.exec(text)

	if (!match || quantityFrom(match[1] ?? '') === undefined)
		return { amount: '', name: text }

	const { unit, rest } = takeUnit((match[2] ?? '').trim())
	const alternate = ALTERNATE.exec(rest)
	const quantity = match[1] ?? ''

	if (!alternate)
		return { amount: [quantity, unit].join(' ').trim(), name: rest }

	const { rest: name } = takeUnit((alternate[1] ?? '').trim())

	const measure = rest
		.slice(0, rest.length - name.length)
		.replace(/^\//, '')
		.trim()

	return {
		amount: [quantity, unit].join(' ').trim(),
		name: `${name} · ${measure}`,
	}
}

// Only separate a trailing parenthetical when the prefix already names an
// ingredient. Nested parentheses are kept intact; ambiguous lines stay whole.
export function splitIngredientDetails(line: string) {
	const start = line.indexOf('(')

	if (start < 1) return { main: line, detail: '' }
	const main = line.slice(0, start).trimEnd()

	if (!parseIngredientLine(main).name) return { main: line, detail: '' }
	let depth = 0

	for (const char of line.slice(start)) {
		if (char === '(') depth += 1
		else if (char === ')') depth -= 1
		else if (depth === 0 && !/\s/.test(char)) return { main: line, detail: '' }

		if (depth < 0) return { main: line, detail: '' }
	}

	return depth === 0
		? { main, detail: line.slice(start) }
		: { main: line, detail: '' }
}

// ===== Subject =====

// What a package or portion is counted in, between the amount and the food.
const CONTAINER =
	/^(?:cans?|jars?|packages?|packets?|sticks?|bottles?|boxes|box|bags?|bunch(?:es)?|heads?|cloves?|pinch(?:es)?|dash(?:es)?|handfuls?|sprigs?|slices?|pieces?|cups?|tbsp|tsp|tablespoons?|teaspoons?|ounces?|oz|g|kg|ml|l|lbs?|pounds?)\.?(?:\s+of)?\s+/i

const SIZE =
	/^(?:(?:heaping|scant|generous|level|packed|rounded|extra-large|large|medium|small|boneless|skinless|bone-in|skin-on)\s*,?\s+)+/i

// The food a line is about, with the measuring around it taken off:
// "1 cup (240ml) milk" and "1 and 1/2 cups (300g) sugar" are milk and sugar,
// "1 (15-ounce) can chickpeas, rinsed" is chickpeas. Anything after the first
// comma is preparation and stays on.
export function ingredientSubject(line: string) {
	let rest = line.trim()

	// Each pass takes off one layer of measuring; a few cover any real line.
	for (let pass = 0; pass < 5; pass++) {
		const next = splitIngredientAmount(rest)
			.name.replace(/^\([^()]*\)\s*/, '')
			.replace(/^(?:and|plus|\+)\s+/i, '')
			.replace(SIZE, '')
			.replace(CONTAINER, '')
			.trim()

		if (!next || next === rest) break
		rest = next
	}

	return rest
}

// ===== Section headings =====

// A recipe's ingredients are a list of lines. A line starting with `## ` names
// a group ("for the sauce") instead of an ingredient.
const HEADING = /^##\s+(.+)$/

export function ingredientHeading(line: string) {
	return HEADING.exec(line.trim())?.[1]?.trim()
}

export function formatIngredientHeading(text: string) {
	const trimmed = text.trim()

	return trimmed ? `## ${trimmed}` : ''
}
