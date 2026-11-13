import { foodOf, neverBuy } from '@/lib/pantry/foods'
import type { PantryCategory } from '@/lib/pantry/model'
import {
	amountOf,
	ingredientHeading,
	ingredientSubject,
} from '@/lib/recipes/ingredient-line'

import { sameItem } from './model'

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

// Measures for a pan, not a shop: nobody buys a teaspoon.
const kitchenMeasures = new Set(['tsp', 'tbsp', 'cup', 'pinch', 'ml'])

// What spoils is bought by what the recipe needs; the rest by the package.
const boughtByNeed = new Set<PantryCategory>(['meat', 'vegetables', 'fruit'])

// A recipe line as it is bought, not cooked. Food bought by the package
// (a jar of cumin, a bottle of soy sauce, a carton of milk) loses the
// amount: "1 tsp ground cumin" is cumin. Fresh food keeps what the recipe
// needs, by weight or by count ("2 lb short ribs", "2 onions"), unless it
// is measured in spoons or cups ("1 cup chopped cilantro" is cilantro).
// Cloves of garlic come as a head, and eggs by the box. A food the catalog
// does not know loses only spoons and cups.
export function shoppingLine(line: string) {
	const bought = groceryLine(line)
	const food = foodOf(bought)
	const unit = amountOf(bought)?.unit ?? ''

	// Spoons and cups never go to the shop, whatever the food: "1 tbsp
	// shaoxing wine" is a bottle of shaoxing wine.
	if (!food)
		return kitchenMeasures.has(unit)
			? ingredientSubject(bought).toLowerCase()
			: bought

	if (food.name === 'garlic' && /\bcloves?\b/i.test(bought))
		return '1 head garlic'

	if (food.name === 'eggs') return 'eggs'

	// Counted food keeps its count, but not a cooking measure of it: "1 cup
	// diced onions" is onions.
	if (food.kind === 'count')
		return kitchenMeasures.has(unit) ? food.name : bought

	return !boughtByNeed.has(food.category) || kitchenMeasures.has(unit)
		? food.name
		: bought
}

// A recipe's lines to buy, as bought: all but its section names and the
// water and ice nobody shops for, and once each, so two recipes' cumin is
// one jar.
export function groceryList(lines: string[]) {
	const seen = new Set<string>()

	return lines.flatMap((line) => {
		if (!line.trim() || ingredientHeading(line) !== undefined || neverBuy(line))
			return []

		const bought = shoppingLine(line)
		const key = sameItem(bought)

		if (seen.has(key)) return []
		seen.add(key)

		return [bought]
	})
}

// The name a bought line goes into the pantry under: the food it is, as the
// catalog names it, or the line without its amount and notes.
export const pantryNameOf = (line: string) =>
	foodOf(line)?.name ?? ingredientSubject(groceryLine(line)).toLowerCase()
