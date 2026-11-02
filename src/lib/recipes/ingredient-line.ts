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
