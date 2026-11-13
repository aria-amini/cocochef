import { foodOf } from '@/lib/pantry/foods'
import type { PantryCategory } from '@/lib/pantry/model'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { amountOf, withAmount } from '@/lib/recipes/ingredient-line'

import { shoppingLine } from './list'

// Amounts as a shop sells them, not as a recipe measures them: nobody buys
// a tablespoon of butter or three quarters of a lime.

// A whole thing with no unit: "3 limes". Offered as a unit so a count is
// one tap away from a weight.
export const each = 'each'

// The units each aisle sells in, most usual first.
const unitsByAisle: Record<PantryCategory, readonly string[]> = {
	vegetables: [each, 'lb', 'bunch'],
	fruit: [each, 'lb', 'bag'],
	meat: ['lb', 'g', 'pack'],
	dairy: [each, 'pack'],
	grains: ['bag', 'box', 'lb'],
	cans: ['can', 'jar'],
	sauces: ['bottle', 'jar'],
	spices: ['jar'],
	frozen: ['bag', 'box'],
	other: [each, 'pack'],
}

// Foods a shop sells their own way.
const unitsByFood = new Map<string, readonly string[]>([
	['eggs', ['dozen', each]],
	['milk', ['carton', 'gallon']],
	['oat milk', ['carton']],
	['almond milk', ['carton']],
	['heavy cream', ['carton']],
	['half and half', ['carton']],
	['butter', ['pack', 'lb']],
	['cheddar', ['pack', 'lb']],
	['mozzarella', ['pack', 'lb']],
	['parmesan', ['pack', 'lb']],
	['yogurt', [each, 'pack']],
	['garlic', ['head']],
	['cilantro', ['bunch']],
	['parsley', ['bunch']],
	['scallions', ['bunch']],
	['kale', ['bunch']],
	['bread', [each]],
	['tortillas', ['pack']],
	['rice', ['bag', 'lb']],
	['flour', ['bag']],
	['sugar', ['bag']],
	['tofu', ['pack']],
])

// The units a line's food is sold in.
export function shoppingUnitsFor(line: string): readonly string[] {
	const food = foodOf(line)
	const own = food && unitsByFood.get(food.name)

	if (own) return own

	if (food?.kind === 'count') return [each, 'lb', 'bag']

	return unitsByAisle[food?.category ?? ingredientCategory(line)]
}

// How much each weight is, in grams, to move between them.
const grams = new Map([
	['g', 1],
	['kg', 1000],
	['oz', 28.35],
	['lb', 453.6],
])

// A weight rounded to what a counter or a scale would say.
function roundWeight(quantity: number, unit: string) {
	if (unit === 'g') return Math.max(50, Math.round(quantity / 50) * 50)

	if (unit === 'oz') return Math.max(1, Math.round(quantity))

	return Math.max(0.5, Math.round(quantity * 4) / 4)
}

// What a unit starts at when it is picked: one of most things, a usual
// pack's worth by weight.
const startAt = new Map([
	['g', 500],
	['oz', 8],
])

// A recipe's measures, which no shop sells by.
const measures = new Set(['tsp', 'tbsp', 'cup', 'pinch', 'ml', 'l', 'clove'])

// The line in another unit. Between weights it converts ("2 lb" is "900
// g"); anything else starts over at that unit's usual amount, since a number
// meant in pounds means nothing in cans. Picking the unit it has does
// nothing.
export function setShoppingUnit(line: string, unit: string) {
	const target = unit === each ? '' : unit
	const amount = amountOf(line)
	const rest = amount ? amount.rest : line.trim()

	if (amount && amount.unit === target) return line

	const from = amount ? grams.get(amount.unit) : undefined
	const to = grams.get(target)

	if (amount && from && to)
		return withAmount(
			roundWeight((amount.quantity * from) / to, target),
			target,
			rest,
		)

	return withAmount(startAt.get(target) ?? 1, target, rest)
}

// How far one tap moves a weight.
function weightStep(quantity: number, unit: string) {
	if (unit === 'g') return quantity < 100 ? 10 : 50

	if (unit === 'oz') return 1

	return 0.5
}

// The line one step up or down. A whole thing steps by one and never below
// one, so "1 lime" stays a lime and never becomes three quarters of one; a
// weight steps by half a pound or fifty grams. A recipe's measure becomes
// the food's first shopping unit, since "3 tbsp butter" is no way to buy it.
export function stepShopping(line: string, by: 1 | -1) {
	const amount = amountOf(line)

	if (!amount) return by > 0 ? `1 ${line.trim()}` : line

	const { quantity, unit, rest } = amount

	if (measures.has(unit))
		return setShoppingUnit(
			withAmount(1, '', rest),
			shoppingUnitsFor(rest)[0] ?? each,
		)

	if (grams.has(unit)) {
		const step = weightStep(by > 0 ? quantity : quantity - 1e-6, unit)

		const next =
			by > 0
				? Math.floor(quantity / step + 1e-6) * step + step
				: Math.ceil(quantity / step - 1e-6) * step - step

		return withAmount(Math.max(step, next), unit, rest)
	}

	const next = by > 0 ? Math.floor(quantity) + 1 : Math.ceil(quantity) - 1

	return withAmount(Math.max(1, next), unit, rest)
}

// A recipe line as a shop sells it, the food and how much to take home, for
// a list beside the recipe: "1/3 tsp ground cumin" is cumin, 1 jar; "2 lb
// short ribs" is short ribs, 2 lb; "3 onions" is onions, 3.
export function buyingAmount(line: string) {
	const bought = shoppingLine(line)
	const amount = amountOf(bought)

	if (amount && !measures.has(amount.unit))
		return {
			name: amount.rest,
			amount: withAmount(amount.quantity, amount.unit, ''),
		}

	const name = amount ? amount.rest : bought
	const unit = shoppingUnitsFor(name)[0] ?? each

	return { name, amount: unit === each ? '1' : withAmount(1, unit, '') }
}
