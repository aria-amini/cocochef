import { SparkleIcon } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { IngredientLineView } from '@/components/ingredient-line-view'
import { suggestIngredientSections } from '@/lib/assistant/server'
import {
	type SuggestionRequest,
	suggestionTitleMin,
} from '@/lib/assistant/suggestions'
import { normalizeIngredientName } from '@/lib/pantry/catalog'
import { cn } from '@/lib/utils/ui'
import { useSettled } from '@/lib/utils/use-settled'

// Sections the recipe's name suggests, kept small under the ingredients: one
// chip each, opened one at a time to see its lines, and taken whole or waved
// off. What the cook already wrote is never suggested again, and what was
// waved off waits behind one chip to bring it back. Nothing to suggest shows
// nothing.
export function IngredientSuggestions({
	title,
	lines,
	onAdd,
}: {
	title: string
	// The rows as written, headings included.
	lines: string[]
	onAdd: (lines: string[], heading?: string) => void
}) {
	const request: SuggestionRequest = {
		title: title.trim(),
		ingredients: lines,
	}

	const settled = useSettled(request, JSON.stringify(request))
	// Hidden at once, before the next answer arrives without them.
	const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
	// The one section opened to show its lines.
	const [open, setOpen] = useState<string>()

	const suggestions = useQuery({
		queryKey: ['ingredient-suggestions', settled],
		queryFn: () => suggestIngredientSections({ data: settled }),
		enabled: settled.title.length >= suggestionTitleMin,
		placeholderData: keepPreviousData,
		staleTime: Number.POSITIVE_INFINITY,
	})

	const offered = (suggestions.data?.sections ?? []).filter(
		(section) => section.ingredients.length,
	)

	const isHidden = (heading: string) =>
		dismissed.has(normalizeIngredientName(heading))

	const sections = offered.filter((section) => !isHidden(section.heading))
	const hidden = offered.length - sections.length

	if (request.title.length < suggestionTitleMin || !offered.length) return null

	const dismiss = (heading: string) =>
		setDismissed((current) =>
			new Set(current).add(normalizeIngredientName(heading)),
		)

	const shown = sections.find((section) => section.heading === open)

	return (
		<div className="flex flex-col gap-2" aria-label="suggestions">
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="text-kitchen-eggplant flex items-center gap-1.5 pr-1 text-xs font-bold">
					<SparkleIcon size={14} weight="fill" aria-hidden />
					might need
				</span>
				{sections.map((section) => (
					<button
						key={section.heading}
						type="button"
						aria-expanded={open === section.heading}
						aria-label={`suggested ${section.heading}`}
						onClick={() =>
							setOpen((current) =>
								current === section.heading ? undefined : section.heading,
							)
						}
						className={cn(
							'border-kitchen-eggplant/40 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm font-semibold transition-colors',
							open === section.heading
								? 'bg-kitchen-eggplant/10 text-kitchen-eggplant border-solid'
								: 'hover:bg-kitchen-eggplant/5',
						)}
					>
						{section.heading}
						<span className="text-muted-foreground text-xs tabular-nums">
							{section.ingredients.length}
						</span>
					</button>
				))}
				{hidden ? (
					<button
						type="button"
						onClick={() => setDismissed(new Set())}
						className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center rounded-full px-2 text-xs font-semibold transition-colors"
					>
						{hidden} hidden
					</button>
				) : null}
			</div>
			{shown ? (
				<section
					aria-label={`suggested ${shown.heading} lines`}
					className="border-kitchen-eggplant/40 bg-kitchen-eggplant/5 animate-in fade-in slide-in-from-top-1 flex flex-col rounded-xl border border-dashed duration-200"
				>
					<ul className="text-foreground/70 flex flex-col py-1">
						{shown.ingredients.map((ingredient) => (
							<li key={ingredient.line} className="flex items-center pr-3">
								<IngredientLineView line={ingredient.line} className="py-1.5" />
								{ingredient.inPantry ? (
									<span className="text-kitchen-basil shrink-0 text-xs font-semibold whitespace-nowrap">
										in pantry
									</span>
								) : null}
							</li>
						))}
					</ul>
					<span className="flex items-center gap-1 px-2 pb-2">
						<button
							type="button"
							onClick={() => {
								onAdd(
									shown.ingredients.map((ingredient) => ingredient.line),
									shown.heading,
								)
								dismiss(shown.heading)
								setOpen(undefined)
							}}
							className="bg-kitchen-eggplant text-accent-foreground min-h-10 rounded-md px-4 text-sm font-bold transition-opacity hover:opacity-90"
						>
							add these {shown.ingredients.length}
						</button>
						<button
							type="button"
							onClick={() => {
								dismiss(shown.heading)
								setOpen(undefined)
							}}
							className="text-muted-foreground hover:text-foreground min-h-10 rounded-md px-3 text-sm font-bold transition-colors"
						>
							no thanks
						</button>
					</span>
				</section>
			) : null}
		</div>
	)
}
