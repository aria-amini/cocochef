import { Check, Plus } from '@phosphor-icons/react'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { BackLink, PageTitle } from '@/components/page'
import {
	catalogSectionId,
	catalogSections,
	categorySprites,
	filterCatalogItems,
	findCatalogSection,
	normalizeIngredientName,
} from '@/lib/pantry/catalog'
import { pantryBulkMax, pantryCategoryLabels } from '@/lib/pantry/model'
import { createPantryItems, listPantry } from '@/lib/pantry/server'
import { resolveSpriteSrc } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/ingredients/bulk')({
	validateSearch: z.object({
		cat: catalogSectionId.optional().catch(undefined),
	}),
	loader: () => listPantry(),
	component: BulkAdd,
})

function BulkAdd() {
	const { cat } = Route.useSearch()
	const items = Route.useLoaderData()
	const section = findCatalogSection(cat)
	const owned = new Set(items.map((item) => normalizeIngredientName(item.name)))

	return (
		<main className="flex-1">
			<div className="mx-auto flex max-w-6xl flex-col gap-5 p-6 pb-28 md:p-10 md:pb-28">
				<div>
					<BackLink
						to={section ? '/ingredients/bulk' : '/ingredients'}
						className="mb-2"
					>
						{section ? 'all sections' : 'ingredients'}
					</BackLink>
					<PageTitle>
						{section ? pantryCategoryLabels[section.id] : 'stock up fast'}
					</PageTitle>
					<p className="text-muted-foreground mt-2 text-sm">
						{section
							? 'tap everything you have, then add them all at once'
							: 'pick a section, tap what you have, repeat'}
					</p>
				</div>

				{section ? (
					<SectionPicker key={section.id} section={section} owned={owned} />
				) : (
					<SectionGrid owned={owned} />
				)}
			</div>
		</main>
	)
}

function SectionGrid({ owned }: { owned: Set<string> }) {
	return (
		<>
			<nav
				aria-label="Sections"
				className="grid grid-cols-2 gap-3 sm:grid-cols-3"
			>
				{catalogSections.map((entry) => {
					const have = entry.items.filter((item) => owned.has(item)).length

					return (
						<Link
							key={entry.id}
							to="/ingredients/bulk"
							search={{ cat: entry.id }}
							className="border-border bg-card flex items-center gap-3 rounded-xl border p-4"
						>
							<img
								src={`/sprites/pantry/${categorySprites[entry.id]}.png`}
								alt=""
								className="size-10 shrink-0 [image-rendering:pixelated] md:size-12"
							/>
							<span className="flex min-w-0 flex-col">
								<span className="font-bold lowercase md:text-lg">
									{pantryCategoryLabels[entry.id]}
								</span>
								<span className="text-muted-foreground font-mono text-xs">
									{have}/{entry.items.length} stashed
								</span>
							</span>
						</Link>
					)
				})}
			</nav>
			<Link
				to="/ingredients"
				className="bg-kitchen-basil self-start rounded-md px-4 py-2 text-xs font-semibold"
			>
				done
			</Link>
		</>
	)
}

function SectionPicker({
	section,
	owned,
}: {
	section: NonNullable<ReturnType<typeof findCatalogSection>>
	owned: Set<string>
}) {
	const router = useRouter()
	const navigate = useNavigate()
	const [query, setQuery] = useState('')
	const label = pantryCategoryLabels[section.id]
	const [custom, setCustom] = useState<string[]>([])
	const [selected, setSelected] = useState<Set<string>>(() => new Set())
	const [pending, setPending] = useState(false)

	const all = [...custom, ...section.items]
	const shown = filterCatalogItems(all, query)
	const typed = normalizeIngredientName(query)

	const canAddTyped =
		typed.length > 0 &&
		typed.length <= 80 &&
		!all.includes(typed) &&
		!owned.has(typed)

	function toggle(name: string) {
		setSelected((current) => {
			const next = new Set(current)

			if (next.has(name)) next.delete(name)
			else if (next.size < pantryBulkMax) next.add(name)

			return next
		})
	}

	function addTyped() {
		if (selected.size >= pantryBulkMax) return

		setCustom((current) => [typed, ...current])
		setSelected((current) => new Set(current).add(typed))
		setQuery('')
	}

	async function submit() {
		if (pending || selected.size === 0) return
		setPending(true)

		try {
			const created = await createPantryItems({
				data: [...selected].map((name) => ({
					name,
					quantity: 1,
					category: section.id,
				})),
			})

			toast.success(`added ${created.length} to ${label}`)
			await router.invalidate()
			await navigate({ to: '/ingredients/bulk', search: {} })
		} catch {
			toast.error("couldn't add those — try again")
			setPending(false)
		}
	}

	return (
		<>
			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-semibold">filter</span>
				<input
					type="search"
					value={query}
					autoComplete="off"
					maxLength={80}
					placeholder={`search ${label}`}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key !== 'Enter') return
						event.preventDefault()
						const [only] = shown

						if (shown.length === 1 && only && !owned.has(only)) {
							toggle(only)
							setQuery('')
						} else if (canAddTyped) {
							addTyped()
						}
					}}
					className="border-input bg-background w-full rounded-md border px-3 py-2 text-lg font-semibold placeholder:opacity-50"
				/>
			</label>

			<ul
				aria-label={`${label} to add`}
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
			>
				{canAddTyped ? (
					<li>
						<button
							type="button"
							onClick={addTyped}
							className="border-foreground/50 hover:border-input flex h-full w-full items-center gap-2 rounded-xl border border-dashed p-2 text-left text-sm font-semibold"
						>
							<Plus size={18} weight="bold" aria-hidden className="m-2" />
							add &ldquo;{typed}&rdquo;
						</button>
					</li>
				) : null}
				{shown.map((name) => {
					const have = owned.has(name)
					const on = selected.has(name)

					return (
						<li key={name}>
							<button
								type="button"
								aria-pressed={on}
								disabled={have}
								onClick={() => toggle(name)}
								className={cn(
									'relative flex h-full w-full items-center gap-2 border p-2 text-left text-sm font-semibold rounded-md',
									on
										? 'border-border bg-kitchen-yolk/40'
										: 'border-border bg-card',
									have && 'opacity-45',
								)}
							>
								<img
									src={resolveSpriteSrc(name, null, section.id)}
									alt=""
									className="size-9 shrink-0 object-contain [image-rendering:pixelated]"
								/>
								<span className="min-w-0 flex-1 leading-tight">{name}</span>
								{on || have ? (
									<Check
										size={16}
										weight="bold"
										aria-hidden
										className="shrink-0"
									/>
								) : null}
								{have ? (
									<span className="sr-only">, already stashed</span>
								) : null}
							</button>
						</li>
					)
				})}
			</ul>

			{shown.length === 0 && !canAddTyped ? (
				<p className="text-muted-foreground text-sm">nothing matches</p>
			) : null}

			<div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t p-3 md:left-48">
				<div className="mx-auto flex max-w-6xl items-center gap-3 px-3 md:px-7">
					<p
						aria-live="polite"
						className="text-muted-foreground flex-1 text-xs font-semibold"
					>
						{selected.size} picked
					</p>
					{selected.size > 0 ? (
						<button
							type="button"
							onClick={() => setSelected(new Set())}
							className="text-xs font-semibold underline underline-offset-4"
						>
							clear
						</button>
					) : null}
					<button
						type="button"
						disabled={pending || selected.size === 0}
						onClick={submit}
						className="bg-kitchen-basil rounded-md px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
					>
						{pending ? 'adding…' : `add ${selected.size}`}
					</button>
				</div>
			</div>
		</>
	)
}
