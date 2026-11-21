import { MinusIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'

import { useGroceryLines, usePantry } from '@/components/use-pantry'
import { authClient } from '@/lib/auth/client'
import { buyingAmount, stepShopping } from '@/lib/groceries/amounts'
import { groceryLine, shoppingLine } from '@/lib/groceries/list'
import { sameItem } from '@/lib/groceries/model'
import { findInPantry, keptOnHand } from '@/lib/pantry/foods'
import { lineStatus } from '@/lib/pantry/status'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import {
	amountOf,
	ingredientHeading,
	ingredientSubject,
	withAmount,
} from '@/lib/recipes/ingredient-line'

// The recipe's food, without its section names, and each food once, as the
// list would take it: salt in the dough and the filling is one salt.
function foodsOf(lines: string[]) {
	const seen = new Set<string>()

	return lines.filter((line) => {
		if (!line.trim() || ingredientHeading(line) !== undefined) return false

		const key = sameItem(shoppingLine(line))

		if (seen.has(key)) return false
		seen.add(key)

		return true
	})
}

// What the kitchen and the list say of a recipe's food: each food, and
// whether it's home, on the list for this recipe, or on it for another.
// Signed out, nothing is known.
export function useRecipeShop(
	recipeId: string,
	lines: string[],
	enabled = true,
) {
	const session = authClient.useSession()
	const signedIn = !!session.data?.user
	const pantry = usePantry(signedIn && enabled)
	const list = useGroceryLines(signedIn && enabled)
	const known = signedIn && pantry.isSuccess && list.isSuccess
	const kept = pantry.data ?? []

	const named = (list.data ?? []).map((item) => ({
		...item,
		name: ingredientSubject(groceryLine(item.text)),
	}))

	const items = named.filter((item) => !item.inCart)
	const waitingTexts = items.map((item) => item.text)

	// In the cart for this recipe is as good as on the list: bought, just not
	// put away yet.
	const carted = named.filter(
		(item) =>
			item.inCart && item.recipes.some((recipe) => recipe.id === recipeId),
	)

	const rows = foodsOf(lines).flatMap((line) => {
		const status = lineStatus(line, kept, waitingTexts)

		if (!status) return []

		// On the list for this recipe, it's in this recipe's cart. On it for
		// another (or typed in by hand), it's still to get here: another
		// recipe's can of tomatoes isn't this one's.
		const match = findInPantry(line, items)
		const forThis = match?.recipes.some((recipe) => recipe.id === recipeId)
		const onList = forThis ? match : findInPantry(line, carted)
		const elsewhere = forThis || onList ? undefined : match
		const have = findInPantry(line, kept)
		const home = have !== undefined && have.level !== 'out' && !have.stale
		const bought = buyingAmount(line)

		return [
			{
				line,
				status,
				name: bought.name,
				// What adding it puts on the list: the food as a shop sells it,
				// in the amount the recipe needs ("2 lb ground beef", "1 jar
				// cumin").
				adds: `${bought.amount} ${bought.name}`,
				onList,
				elsewhere,
				home,
				// The pantry's item for it, home or not, so the cook can say
				// it isn't after all.
				item: have,
				// Kept on hand, as salt is: one not bought is most likely home.
				staple: have?.staple ?? keptOnHand(line, ingredientCategory(line)),
			},
		]
	})

	// Whether the pantry knows anything yet: until it does, a recipe can't
	// say what's missing, only offer all of it.
	const stocked = kept.length > 0

	return { signedIn, known, rows, stocked }
}

export type RecipeShop = ReturnType<typeof useRecipeShop>

// A list line with its amount said: one typed with none ("flour") is what a
// shop sells one of ("1 bag flour"), so its stepper has a number to step.
export function withAmountSaid(text: string) {
	if (amountOf(text)) return text

	// Only the amount goes in front: "chicken thighs, boneless" keeps how
	// the cook put it.
	return `${buyingAmount(text).amount} ${text}`
}

// How much a list line says to buy, as its stepper shows it: "2 lb", "3
// bags", "4".
export function amountShown(text: string) {
	const amount = amountOf(withAmountSaid(text))

	return amount ? withAmount(amount.quantity, amount.unit, '') : '1'
}

// Two amounts of one food as one line: added up when they're in the same
// unit ("1 can" and "1 can" is "2 cans"), else the first a step bigger.
export function together(onList: string, more: string) {
	const a = amountOf(withAmountSaid(onList))
	const b = amountOf(withAmountSaid(more))

	if (a && b && a.unit === b.unit)
		return withAmount(a.quantity + b.quantity, a.unit, a.rest)

	return stepShopping(withAmountSaid(onList), 1)
}

// How much of a food is in the cart, on a yolk pill to change in store
// steps: less, the amount, more; at the least, a bin takes it out.
export function CartStepper({
	name,
	text,
	disabled = false,
	onStep,
	onTakeOff,
}: {
	name: string
	text: string
	disabled?: boolean
	onStep: (by: 1 | -1) => void
	onTakeOff: () => void
}) {
	const said = withAmountSaid(text)
	const least = stepShopping(said, -1) === said

	return (
		<span className="bg-kitchen-yolk/40 flex min-h-9 shrink-0 items-center rounded-md">
			<button
				type="button"
				aria-label={least ? `take ${name} out of your cart` : `less ${name}`}
				disabled={disabled}
				onClick={() => (least ? onTakeOff() : onStep(-1))}
				className="grid size-9 place-items-center rounded-md disabled:opacity-50"
			>
				{least ? (
					<TrashIcon size={15} weight="bold" aria-hidden />
				) : (
					<MinusIcon size={15} weight="bold" aria-hidden />
				)}
			</button>
			<span
				aria-live="polite"
				className="min-w-16 text-center text-sm font-bold tabular-nums"
			>
				{amountShown(text)}
			</span>
			<button
				type="button"
				aria-label={`more ${name}`}
				disabled={disabled}
				onClick={() => onStep(1)}
				className="grid size-9 place-items-center rounded-md disabled:opacity-50"
			>
				<PlusIcon size={15} weight="bold" aria-hidden />
			</button>
		</span>
	)
}
