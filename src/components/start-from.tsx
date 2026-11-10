import { MagnifyingGlassIcon } from '@phosphor-icons/react'

import { useRecipeActions } from '@/components/recipe-actions'
import { useOnlineRecipes } from '@/components/recipe-online'
import { useSettled } from '@/lib/utils/use-settled'

// What a recipe found online gives one being written: its lines, and where it
// came from, to credit.
export type StartingPoint = {
	title: string
	sourceUrl: string | undefined
	ingredients: string[]
	steps: string[]
}

// A name this short says nothing about the dish yet.
const nameMin = 3

const countShown = 12

// A way to start a recipe from its name: once the name written so far finds
// recipes online, a quiet offer under it opens the search, already holding
// the name, to pick one whose lines fill the recipe.
export function FindRecipe({
	name,
	onStart,
}: {
	name: string
	onStart: (start: StartingPoint) => void
}) {
	const { find } = useRecipeActions()
	const named = name.trim()
	const settled = useSettled(named, named)

	const online = useOnlineRecipes(
		settled.length >= nameMin ? settled : undefined,
	)

	const found = online.results.filter(
		(recipe) => recipe.siteName && !recipe.draft,
	).length

	// The offer waits for the name to settle, and for something to offer.
	if (named !== settled || !found) return null

	return (
		<button
			type="button"
			onClick={() => find(named, onStart)}
			className="animate-in fade-in text-kitchen-eggplant bg-kitchen-eggplant/10 hover:bg-kitchen-eggplant/15 inline-flex min-h-9 max-w-full items-center gap-1.5 self-start rounded-full px-3 text-sm font-semibold transition-colors duration-300"
		>
			<MagnifyingGlassIcon size={14} weight="bold" aria-hidden />
			<span className="truncate">start from a recipe like “{named}”</span>
			<span className="text-kitchen-eggplant/70 shrink-0 font-normal">
				· {found > countShown ? `${countShown}+` : found} found
			</span>
		</button>
	)
}
