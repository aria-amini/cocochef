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

// The short form each measure is shown in, however the line spells it.
const abbreviations: [RegExp, string][] = [
	[/^(?:tablespoons?|tbsps?|tbs|tbl|tb)$/i, 'tbsp'],
	[/^(?:teaspoons?|tsps?|ts)$/i, 'tsp'],
	[/^(?:ounces?|oz)$/i, 'oz'],
	[/^(?:pounds?|lbs?)$/i, 'lb'],
	[/^(?:grams?|gr)$/i, 'g'],
	[/^(?:kilograms?|kilos?|kgs?)$/i, 'kg'],
	[/^(?:millilit(?:er|re)s?|mls?)$/i, 'ml'],
	[/^(?:lit(?:er|re)s?)$/i, 'l'],
]

const MEASURE_AFTER_NUMBER =
	/(\d|[¼½¾⅓⅔⅛])(\s*|-)(tablespoons?|tbsps?|tbs|tbl|teaspoons?|tsps?|ounces?|pounds?|lbs|grams?|kilograms?|kilos?|millilit(?:er|re)s?|lit(?:er|re)s?)\.?(?=[\s),/]|$)/giu

// A line with its measures in their short form: "2 tablespoons butter" reads
// "2 tbsp butter", and "1 (15-ounce) can" reads "1 (15-oz) can". Only a word
// right after a number is a measure, so "pound the chicken" stays as it is.
export function abbreviateUnits(text: string) {
	return text.replace(MEASURE_AFTER_NUMBER, (whole, digit, gap, unit) => {
		const short = abbreviations.find(([pattern]) => pattern.test(unit))?.[1]

		return short ? `${digit}${gap}${short}` : whole
	})
}

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
// of the name, unless `includeAlternate` is off.
export function splitIngredientAmount(line: string, includeAlternate = true) {
	const text = line.trim()
	const match = LINE.exec(text)

	if (!match || quantityFrom(match[1] ?? '') === undefined)
		return { amount: '', name: text }

	const { unit, rest } = takeUnit((match[2] ?? '').trim())
	const alternate = ALTERNATE.exec(rest)
	const quantity = match[1] ?? ''

	if (!alternate)
		return {
			amount: abbreviateUnits([quantity, unit].join(' ').trim()),
			name: rest,
		}

	const { rest: name } = takeUnit((alternate[1] ?? '').trim())

	const measure = rest
		.slice(0, rest.length - name.length)
		.replace(/^\//, '')
		.trim()

	return {
		amount: abbreviateUnits([quantity, unit].join(' ').trim()),
		name: includeAlternate ? `${name} · ${abbreviateUnits(measure)}` : name,
	}
}

// The amount at the start of a line as it was typed ("1 ½ tablespoons"), once
// a space after it shows it is finished; nothing while it may still grow, so
// "1" in "12 g" is not taken early.
export function settledAmount(line: string) {
	const match = new RegExp(`^(${QUANTITY})`, 'u').exec(line)
	const quantity = match?.[1]

	if (!quantity || quantityFrom(quantity) === undefined) return undefined

	const after = line.slice(quantity.length)
	const unit = /^(\s*)(\S+)/.exec(after)
	const word = unit?.[2] ?? ''

	const amount = unitByAlias.has(word.toLowerCase().replace(/\.$/, ''))
		? quantity + (unit?.[1] ?? '') + word
		: quantity

	return /^\s/.test(line.slice(amount.length)) ? amount : undefined
}

// A line with its settled amount in the short form ("1 tablespoon " becomes
// "1 tbsp "), the rest as typed.
export function settleAmount(line: string) {
	const amount = settledAmount(line)

	return amount ? abbreviateUnits(amount) + line.slice(amount.length) : line
}

// ===== Adjusting an amount =====

// The units the amount bar offers, in the order a cook reaches for them.
export const amountUnits = ['tsp', 'tbsp', 'cup', 'g', 'ml'] as const

// Units counted in whole things take a plural after more than one.
const plurals = new Map([
	['cup', 'cups'],
	['clove', 'cloves'],
	['can', 'cans'],
	['bunch', 'bunches'],
	['pinch', 'pinches'],
])

const glyphs: [number, string][] = [
	[0.125, '⅛'],
	[0.25, '¼'],
	[1 / 3, '⅓'],
	[0.5, '½'],
	[2 / 3, '⅔'],
	[0.75, '¾'],
]

// A quantity as a cook writes it: "1 ½", "¾", "250"; a share no glyph fits
// stays a short decimal.
export function formatQuantity(quantity: number) {
	const whole = Math.floor(quantity + 1e-9)
	const part = quantity - whole
	const glyph = glyphs.find(([value]) => Math.abs(value - part) < 0.01)?.[1]

	if (part < 0.01) return String(whole)

	if (glyph) return whole ? `${whole} ${glyph}` : glyph

	return String(Number(quantity.toFixed(2)))
}

// A line's amount taken apart: how much, in what (its usual short name), and
// the rest of the line as written. Nothing for a line with no amount.
export function amountOf(line: string) {
	const text = line.trimStart()
	const match = LINE.exec(text)
	const quantity = match?.[1] ? quantityFrom(match[1]) : undefined

	if (!match || quantity === undefined) return undefined

	const { unit, rest } = takeUnit((match[2] ?? '').trim())
	const canonical = unitByAlias.get(unit.toLowerCase().replace(/\.$/, '')) ?? ''

	return { quantity, unit: canonical, rest }
}

function withAmount(quantity: number, unit: string, rest: string) {
	const named = quantity > 1 ? (plurals.get(unit) ?? unit) : unit

	return [formatQuantity(quantity), named, rest].filter(Boolean).join(' ')
}

// How far one tap moves an amount in this unit: a quarter of a spoon below
// one, a half above it, and so on, so each step is one a cook would make.
function stepFor(quantity: number, unit: string) {
	if (unit === 'tsp' || unit === 'tbsp') return quantity < 1 ? 0.25 : 0.5

	if (unit === 'cup' || unit === 'lb' || unit === 'kg' || unit === 'l')
		return 0.25

	if (unit === 'g' || unit === 'ml')
		return quantity < 25 ? 5 : quantity < 100 ? 25 : 50

	if (unit === 'oz') return quantity < 4 ? 0.5 : 1

	return quantity < 1 ? 0.25 : 1
}

// The line with its amount one step up or down, landing on the step's own
// marks ("1 ⅓ tbsp" up is "1 ½"). An amount never steps below its smallest
// step; a line with none starts at 1.
export function stepAmount(line: string, by: 1 | -1) {
	const amount = amountOf(line)

	if (!amount) return by > 0 ? `1 ${line.trim()}` : line

	const { quantity, unit, rest } = amount
	const step = stepFor(by > 0 ? quantity : quantity - 1e-6, unit)

	const next =
		by > 0
			? Math.floor(quantity / step + 1e-6) * step + step
			: Math.ceil(quantity / step - 1e-6) * step - step

	return withAmount(next > 0 ? next : step, unit, rest)
}

// The line in another unit, the number kept: the cook is relabelling, not
// converting.
export function setAmountUnit(line: string, unit: string) {
	const amount = amountOf(line)

	if (!amount) return `1 ${unit} ${line.trim()}`.trim()

	return withAmount(
		amount.quantity,
		amount.unit === unit ? '' : unit,
		amount.rest,
	)
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
		const next = splitIngredientAmount(rest, false)
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
