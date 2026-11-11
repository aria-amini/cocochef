import { ingredientHeading } from '@/lib/recipes/ingredient-line'

// The words a preparation note is made of: "finely chopped", "to taste",
// "cut into 1-inch pieces". The list is closed on purpose and holds no word
// that could be a food ("seeds", "skin"): a note with any other word in it
// ("dried apricots", "seaweed") may name the food, so the line stays whole
// rather than lose it.
const preparationWord =
	/^(?:finely|roughly|coarsely|thinly|thickly|lightly|freshly|very|well|chopped|minced|diced|sliced|grated|shredded|peeled|crushed|cubed|halved|quartered|trimmed|rinsed|drained|softened|melted|beaten|cooked|toasted|roasted|seeded|pitted|cored|mashed|packed|sifted|divided|thawed|frozen|warmed|chilled|zested|juiced|deveined|skinned|scrubbed|torn|cut|smashed|crumbled|squeezed|whisked|stemmed|washed|dried|[\d/.-]+(?:inch|cm|mm)?|to|taste|plus|more|for|serving|garnish|at|room|temperature|optional|or|and|into|pieces|piece|inch|cubes|chunks|slices|strips|left|if|needed|about|the|a|of|in|removed|on|off|thin|thick)$/i

const isPreparation = (note: string) => {
	const words = note
		.replace(/\([^()]*\)/g, ' ')
		.toLowerCase()
		.split(/[^\p{L}\p{N}/.-]+/u)
		.filter(Boolean)

	return words.length > 0 && words.every((word) => preparationWord.test(word))
}

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
			isPreparation(line.slice(at + 1))
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
