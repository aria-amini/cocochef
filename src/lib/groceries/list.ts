import { ingredientHeading } from '@/lib/recipes/ingredient-line'

// A recipe line as it reads on a grocery list: what to buy and how much, with
// the preparation after the first comma and any note in brackets at the end
// left in the kitchen. "2 cloves garlic, minced" is "2 cloves garlic".
export function groceryLine(line: string) {
	let depth = 0
	let end = line.length

	for (let at = 0; at < line.length; at++) {
		const char = line[at]

		if (char === '(') depth += 1
		else if (char === ')') depth = Math.max(0, depth - 1)
		else if (char === ',' && depth === 0) {
			end = at
			break
		}
	}

	const kept = line.slice(0, end).trim()
	const bare = kept.replace(/\s*\([^()]*\)$/, '').trim()

	return bare || kept
}

// A recipe's lines to buy, one each: all but its section names.
export function groceryList(lines: string[]) {
	return lines.flatMap((line) =>
		!line.trim() || ingredientHeading(line) !== undefined
			? []
			: [groceryLine(line)],
	)
}
