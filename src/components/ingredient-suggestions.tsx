import { Plus, SparkleIcon, X } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { suggestIngredientSections } from '@/lib/assistant/server'
import {
	type SuggestionRequest,
	suggestionTitleMin,
} from '@/lib/assistant/suggestions'
import { normalizeIngredientName } from '@/lib/pantry/catalog'
import { cn } from '@/lib/utils/ui'

// Typing settles before the editor asks again.
const settleMs = 400

function useSettled<T>(value: T, key: string) {
	const [settled, setSettled] = useState({ value, key })

	useEffect(() => {
		if (key === settled.key) return
		const timer = window.setTimeout(() => setSettled({ value, key }), settleMs)

		return () => window.clearTimeout(timer)
	}, [value, key, settled.key])

	return settled.value
}

const ghostButtonClassName =
	'text-muted-foreground hover:text-foreground hover:bg-card inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors'

// Sections the recipe's name suggests, drawn faintly under the ingredients
// until the cook takes or dismisses them: a whole section at once, or a line at
// a time. What the cook already wrote is never suggested again. Asking again
// brings back what was dismissed, or says there is nothing to suggest.
export function IngredientSuggestions({
	title,
	lines,
	asked,
	onAdd,
}: {
	title: string
	// The rows as written, headings included.
	lines: string[]
	// Counts the cook's requests; a new count is a new request.
	asked: number
	onAdd: (lines: string[], heading?: string) => void
}) {
	const request: SuggestionRequest = {
		title: title.trim(),
		ingredients: lines,
	}

	const settled = useSettled(request, JSON.stringify(request))
	// Hidden at once, before the next answer arrives without them.
	const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
	const [taken, setTaken] = useState<Set<string>>(() => new Set())
	// The name the cook last asked about, while the answer is theirs to read.
	const [answered, setAnswered] = useState({ asked, title: '' })

	if (asked !== answered.asked) {
		setAnswered({ asked, title: title.trim() })
		setDismissed(new Set())
		setTaken(new Set())
	}

	const suggestions = useQuery({
		queryKey: ['ingredient-suggestions', settled],
		queryFn: () => suggestIngredientSections({ data: settled }),
		enabled: settled.title.length >= suggestionTitleMin,
		placeholderData: keepPreviousData,
		staleTime: Number.POSITIVE_INFINITY,
	})

	if (request.title.length < suggestionTitleMin) return null

	const sections = (suggestions.data?.sections ?? [])
		.filter(
			(section) => !dismissed.has(normalizeIngredientName(section.heading)),
		)
		.map((section) => ({
			...section,
			ingredients: section.ingredients.filter(
				(ingredient) => !taken.has(ingredient.line),
			),
		}))
		.filter((section) => section.ingredients.length)

	if (!sections.length)
		return answered.title === request.title &&
			!suggestions.isFetching &&
			!suggestions.isPlaceholderData ? (
			<output className="text-muted-foreground block px-3 text-sm">
				nothing to suggest for {request.title} yet.
			</output>
		) : null

	const dismiss = (heading: string) =>
		setDismissed((current) =>
			new Set(current).add(normalizeIngredientName(heading)),
		)

	return (
		<div className="flex flex-col gap-2" aria-label="suggestions">
			{sections.map((section) => (
				<section
					key={section.heading}
					aria-label={`suggested ${section.heading}`}
					className="border-kitchen-eggplant/40 bg-kitchen-eggplant/5 flex flex-col gap-1 rounded-xl border border-dashed p-2"
				>
					<header className="flex items-center gap-1 pl-2">
						<SparkleIcon
							size={16}
							weight="duotone"
							aria-hidden
							className="text-kitchen-eggplant shrink-0"
						/>
						<h3 className="min-w-0 flex-1 truncate text-sm font-bold">
							<span className="sr-only">suggested </span>
							{section.heading}
						</h3>
						<button
							type="button"
							className={ghostButtonClassName}
							onClick={() => {
								onAdd(
									section.ingredients.map((ingredient) => ingredient.line),
									section.heading,
								)
								dismiss(section.heading)
							}}
						>
							<Plus size={14} weight="bold" aria-hidden />
							add all
						</button>
						<button
							type="button"
							aria-label={`Dismiss suggested ${section.heading}`}
							className={cn(ghostButtonClassName, 'size-9 justify-center px-0')}
							onClick={() => dismiss(section.heading)}
						>
							<X size={14} weight="bold" aria-hidden />
						</button>
					</header>
					<ul className="flex flex-col">
						{section.ingredients.map((ingredient) => (
							<li key={ingredient.line} className="flex items-center gap-2">
								<button
									type="button"
									aria-label={`Add ${ingredient.line}`}
									className="text-muted-foreground hover:text-foreground hover:bg-card flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition-colors"
									onClick={() => {
										onAdd([ingredient.line])
										setTaken((current) => new Set(current).add(ingredient.line))
									}}
								>
									<Plus
										size={12}
										weight="bold"
										aria-hidden
										className="shrink-0"
									/>
									<span className="min-w-0 flex-1 truncate">
										{ingredient.line}
									</span>
								</button>
								{ingredient.inPantry ? (
									<span className="text-kitchen-basil border-kitchen-basil/40 mr-2 shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
										in pantry
									</span>
								) : null}
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	)
}
