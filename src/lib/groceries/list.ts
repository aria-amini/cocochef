import { ingredientHeading } from '@/lib/recipes/ingredient-line'

// Words that describe the food rather than name it: a comma after one joins
// two descriptions ("2 large, ripe tomatoes"), not a food and its note.
const describing =
	/(?:^|\s)(?:\w+ed|large|small|medium|big|ripe|fresh|whole|extra|good|firm|heaping|thick|thin|mild|hot|sweet|red|green|yellow|white|black)$/i

// Words that start a preparation note after a comma: "minced", "to taste".
const preparation =
	/^\s*(?:\w+ly\s+)?(?:\w{3,}ed\b|\w+en\b|to taste|divided|plus\b|for\b|at room|optional|or\b|and\b|cut\b|torn\b|left\b|room temperature|softened|melted|beaten|grated|thawed|drained|rinsed|trimmed|peeled|halved|quartered|seeded|zested|juiced)/i

// A recipe line as it reads on a grocery list: what to buy and how much, with
// a preparation note after a comma, and a bracketed note with no amount in it,
// left in the kitchen. "2 cloves garlic, minced" is "2 cloves garlic"; "2
// large, ripe tomatoes" and "tomatoes (2 x 400 g cans)" stay whole.
export function groceryLine(line: string) {
	let depth = 0
	let end = line.length

	for (let at = 0; at < line.length; at++) {
		const char = line[at]

		if (char === '(') depth += 1
		else if (char === ')') depth = Math.max(0, depth - 1)
		else if (
			char === ',' &&
			depth === 0 &&
			// "1,000 g" is one number.
			!/\d/.test(line[at - 1] ?? '') &&
			!describing.test(line.slice(0, at).trim()) &&
			preparation.test(line.slice(at + 1))
		) {
			end = at
			break
		}
	}

	const kept = line.slice(0, end).trim()
	const bare = kept.replace(/\s*\([^()\d]*\)$/, '').trim()

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
