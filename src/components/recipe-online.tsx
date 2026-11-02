import { useEffect, useRef, useState } from 'react'

import { searchRecipes } from '@/lib/discover/server'
import { importRecipe } from '@/lib/import/server'
import { cn } from '@/lib/utils/ui'

type Result = Awaited<ReturnType<typeof searchRecipes>>['results'][number]

const WARM_POLL_MS = 2000

// A link is anything that starts like one; everything else is a search.
export function asRecipeUrl(value: string) {
	if (/^https?:\/\/\S+$/i.test(value)) return value

	if (/^www\.\S+$/i.test(value)) return `https://${value}`

	return undefined
}

type OnlineSearch = {
	results: Result[]
	loading: boolean
	warming: boolean
	failed: boolean
}

type Settled = Omit<OnlineSearch, 'loading'> & { query?: string }

// Searches the recipe sites for `query` once it settles. Pass `undefined` to
// stay idle. The first search starts the crawl, so keep asking while sites load.
export function useOnlineRecipes(query: string | undefined): OnlineSearch {
	const [settled, setSettled] = useState<Settled>({
		results: [],
		warming: false,
		failed: false,
	})

	useEffect(() => {
		if (query === undefined) return

		let cancelled = false
		let timer: ReturnType<typeof setTimeout>

		async function run(q: string) {
			try {
				const found = await searchRecipes({ data: { q: q.slice(0, 80) } })

				if (cancelled) return
				setSettled({
					query: q,
					results: found.results,
					warming: found.warming,
					failed: false,
				})

				if (found.warming) timer = setTimeout(() => void run(q), WARM_POLL_MS)
			} catch {
				if (!cancelled)
					setSettled({ query: q, results: [], warming: false, failed: true })
			}
		}

		timer = setTimeout(() => void run(query), query ? 200 : 0)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [query])

	// Results belong to the query that fetched them; a new query starts empty.
	const current = query !== undefined && settled.query === query

	return {
		results: current ? settled.results : [],
		warming: current && settled.warming,
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

// A recipe's picture, or its first letter on a yolk tile when it has none.
export function RecipeThumb({
	imageUrl,
	title,
	className,
}: {
	imageUrl?: string | null | undefined
	title: string
	className?: string | undefined
}) {
	const [broken, setBroken] = useState(false)

	if (!imageUrl || broken)
		return (
			<span
				aria-hidden
				className={cn(
					'bg-kitchen-yolk border-border grid size-10 shrink-0 place-items-center rounded-lg border text-sm font-bold',
					className,
				)}
			>
				{title.charAt(0)}
			</span>
		)

	return (
		<img
			src={imageUrl}
			alt=""
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={() => setBroken(true)}
			className={cn(
				'border-border size-10 shrink-0 rounded-lg border object-cover',
				className,
			)}
		/>
	)
}
