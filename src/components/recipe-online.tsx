import { useHydrated } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { RecipeGlyph } from '@/components/recipe-glyph'
import { hasPicks, type MealPicks } from '@/lib/assistant/meal-parts'
import { searchRecipes } from '@/lib/discover/server'
import { importRecipe } from '@/lib/import/server'
import { sizedPhoto } from '@/lib/photos/sized'
import type { RecipeSort } from '@/lib/recipes/loved'
import { cn } from '@/lib/utils/ui'

type Result = Awaited<ReturnType<typeof searchRecipes>>['results'][number]

// A link is anything that starts like one; everything else is a search.
export function asRecipeUrl(value: string) {
	if (/^https?:\/\/\S+$/i.test(value)) return value

	if (/^www\.\S+$/i.test(value)) return `https://${value}`

	return undefined
}

type Found = Awaited<ReturnType<typeof searchRecipes>>

type OnlineSearch = {
	results: Result[]
	// How many of every match each bubble would leave, when the server counted.
	counts?: Found['counts']
	loading: boolean
	failed: boolean
}

type Settled = Omit<OnlineSearch, 'loading'> & { asked?: string }

const noPicks: MealPicks = {}

// What was asked, so results answer only the question that fetched them.
const askedOf = (
	query: string,
	sort: RecipeSort | undefined,
	picks: MealPicks,
) => JSON.stringify([sort ?? '', query, picks])

// Searches cocochef's recipes for `query` once it settles, or sorted by `sort`,
// every rated recipe; `picks` (kept in state, so one object while unchanged)
// narrow every match on the server. Pass `undefined` to stay idle.
export function useOnlineRecipes(
	query: string | undefined,
	sort?: RecipeSort,
	picks: MealPicks = noPicks,
): OnlineSearch {
	const asked = query === undefined ? undefined : askedOf(query, sort, picks)

	const [settled, setSettled] = useState<Settled>({
		results: [],
		failed: false,
	})

	useEffect(() => {
		if (query === undefined) return

		let cancelled = false
		let timer: ReturnType<typeof setTimeout>

		// Sent only when something is picked.
		const asking = hasPicks(picks)
			? {
					picks: {
						cuisine: picks.cuisine && [...picks.cuisine],
						protein: picks.protein && [...picks.protein],
						form: picks.form && [...picks.form],
					},
				}
			: {}

		async function run(q: string) {
			try {
				const found = await searchRecipes({
					data: { q: q.slice(0, 80), sort, ...asking },
				})

				if (cancelled) return
				setSettled({
					asked: askedOf(q, sort, picks),
					results: found.results,
					counts: found.counts,
					failed: false,
				})
			} catch {
				if (!cancelled)
					setSettled({
						asked: askedOf(q, sort, picks),
						results: [],
						failed: true,
					})
			}
		}

		timer = setTimeout(() => void run(query), query ? 200 : 0)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [query, sort, picks])

	// Results belong to the question that fetched them; a new one starts empty.
	// The last counts stay while the next ones load, so bubbles don't flicker;
	// a failed search has none.
	const current = asked !== undefined && settled.asked === asked

	return {
		results: current ? settled.results : [],
		counts: settled.counts,
		failed: current && settled.failed,
		loading: query !== undefined && !current,
	}
}

type Imported = { id: string; title: string }

// Imports a recipe by link and reports success to `onImported`; `keep` also
// puts it on the shelf. One import runs at a time; a failure leaves the message
// in `error`.
export function useRecipeImport(
	onImported: (recipe: Imported) => void | Promise<void>,
) {
	const [saving, setSaving] = useState<string>()
	const [error, setError] = useState<string>()
	const active = useRef(true)

	useEffect(() => {
		active.current = true

		return () => {
			active.current = false
		}
	}, [])

	async function save(target: string, { keep = false } = {}) {
		if (saving) return
		setSaving(target)
		setError(undefined)

		try {
			const recipe = await importRecipe({ data: { url: target, keep } })

			if (active.current) await onImported(recipe)
		} catch (cause) {
			if (!active.current) return
			setError(
				cause instanceof Error
					? cause.message
					: "couldn't save that — try again",
			)
			setSaving(undefined)
		}
	}

	return { saving, error, save, clearError: () => setError(undefined) }
}

// A recipe's picture, or an icon for its name on a yolk tile when it has none.
export function RecipeThumb({
	imageUrl,
	title,
	className,
	glyphSize = 22,
}: {
	imageUrl?: string | null | undefined
	title: string
	className?: string | undefined
	glyphSize?: number
}) {
	const [broken, setBroken] = useState(false)
	const hydrated = useHydrated()

	if (!imageUrl || broken)
		return (
			<span
				aria-hidden
				className={cn(
					'bg-kitchen-yolk border-border grid size-10 shrink-0 place-items-center rounded-md border',
					className,
				)}
			>
				<RecipeGlyph title={title} size={glyphSize} />
			</span>
		)

	// A full-size photo from the recipe's site, drawn small. A list drawn by
	// the server holds its photos' places until the page's code has loaded:
	// coming from other sites, they would take the bandwidth the code needs,
	// and keep taps waiting.
	if (!hydrated)
		return (
			<span
				aria-hidden
				className={cn(
					'bg-muted border-border block size-10 shrink-0 rounded-md border',
					className,
				)}
			/>
		)

	return (
		<img
			src={sizedPhoto(imageUrl, 400)}
			alt=""
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			onError={() => setBroken(true)}
			className={cn(
				'border-border size-10 shrink-0 rounded-md border object-cover',
				className,
			)}
		/>
	)
}
