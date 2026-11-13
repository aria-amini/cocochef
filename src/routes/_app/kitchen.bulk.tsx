import { Check, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { BackLink, PageTitle } from '@/components/page'
import { PantrySprite } from '@/components/pantry-sprite'
import { buttonVariants } from '@/components/ui/button'
import {
	catalogSectionId,
	catalogSections,
	categorySprites,
	filterCatalogItems,
	findCatalogSection,
	normalizeIngredientName,
} from '@/lib/pantry/catalog'
import { pantryBulkMax, pantryCategoryLabels } from '@/lib/pantry/model'
import {
	createPantryItems,
	listPantry,
	restockPantryItem,
} from '@/lib/pantry/server'
import { resolveSpriteLook } from '@/lib/pantry/sprites'
import { standardLook } from '@/lib/pantry/tinted-sprites'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/kitchen/bulk')({
	staticData: { tabBar: 'none' },
	validateSearch: z.object({
		cat: catalogSectionId.optional().catch(undefined),
	}),
	// Signed out, there is no pantry to add to: its page says how to get one.
	loader: async () => {
		const items = await listPantry()

		if (!items) throw redirect({ to: '/kitchen' })

		return items
	},
	component: BulkAdd,
})

function BulkAdd() {
	const { cat } = Route.useSearch()
	const items = Route.useLoaderData()
	const section = findCatalogSection(cat)
	const owned = new Set(items.map((item) => normalizeIngredientName(item.name)))

	// What ran out or runs low can be picked again here, to restock it.
	const wanting = new Map(
		items
			.filter((item) => item.level !== 'plenty')
			.map((item) => [normalizeIngredientName(item.name), item] as const),
	)

	return (
		<main className="flex-1">
			<div className="flex max-w-3xl flex-col gap-5 p-6 pb-28 md:p-10 md:pb-28">
				<div>
					<BackLink
						to={section ? '/kitchen/bulk' : '/kitchen'}
						className="mb-2"
					>
						{section ? 'all sections' : 'ingredients'}
					</BackLink>
					<PageTitle>
						{section ? pantryCategoryLabels[section.id] : 'add ingredients'}
					</PageTitle>
					<p className="text-muted-foreground mt-2 text-sm">
						{section
							? 'tap everything you have, then add them all at once'
							: 'pick a section, tap what you have, repeat'}
					</p>
				</div>

				{section ? (
					<SectionPicker
						key={section.id}
						section={section}
						owned={owned}
						wanting={wanting}
					/>
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
				aria-label="sections"
				className="grid grid-cols-2 gap-3 sm:grid-cols-3"
			>
				{catalogSections.map((entry) => {
					const have = entry.items.filter((item) => owned.has(item)).length

					return (
						<Link
							key={entry.id}
							to="/kitchen/bulk"
							search={{ cat: entry.id }}
							className="border-border bg-card flex items-center gap-3 rounded-xl border p-4"
						>
							<PantrySprite
								look={standardLook({ key: categorySprites[entry.id] })}
								className="size-10 shrink-0 md:size-12"
							/>
							<span className="flex min-w-0 flex-col">
								<span className="font-bold lowercase md:text-lg">
									{pantryCategoryLabels[entry.id]}
								</span>
								<span className="text-muted-foreground text-xs font-semibold">
									{have ? `${have} kept` : 'none yet'}
								</span>
							</span>
						</Link>
					)
				})}
			</nav>
			<Link
				to="/kitchen"
				className={buttonVariants({ className: 'self-start' })}
			>
				done
			</Link>
		</>
	)
}

function SectionPicker({
	section,
	owned,
	wanting,
}: {
	section: NonNullable<ReturnType<typeof findCatalogSection>>
	owned: Set<string>
	wanting: ReadonlyMap<string, { id: string; level: string }>
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

	// Kept food is greyed out, unless it ran out or runs low.
	const pickable = (name: string) => !owned.has(name) || wanting.has(name)

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
			const picked = [...selected]
			const restocked = picked.flatMap((name) => wanting.get(name) ?? [])
			const fresh = picked.filter((name) => !wanting.has(name))

			if (fresh.length)
				await createPantryItems({
					data: fresh.map((name) => ({ name, category: section.id })),
				})

			for (const item of restocked)
				await restockPantryItem({ data: { id: item.id } })

			toast.success(
				fresh.length && restocked.length
					? `added ${fresh.length}, restocked ${restocked.length}`
					: fresh.length
						? `added ${fresh.length} to ${label}`
						: `restocked ${restocked.length}`,
			)
			await router.invalidate()
			// Back to the kitchen's newest, where what was added can be seen;
			// use first would hide food that keeps for weeks.
			await navigate({ to: '/kitchen', search: { list: 'recent' } })
		} catch {
			toast.error("couldn't add those — try again")
			setPending(false)
		}
	}

	return (
		<>
			<label className="bg-card border-input focus-within:border-foreground/40 flex min-h-11 items-center gap-2 rounded-xl border px-3 transition-colors">
				<MagnifyingGlass
					size={18}
					weight="bold"
					aria-hidden
					className="text-muted-foreground shrink-0"
				/>
				<span className="sr-only">find in {label}</span>
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

						if (shown.length === 1 && only && pickable(only)) {
							toggle(only)
							setQuery('')
						} else if (canAddTyped) {
							addTyped()
						}
					}}
					className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden"
				/>
			</label>

			<ul
				aria-label={`${label} to add`}
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
			>
				{shown.map((name) => {
					const have = !pickable(name)
					const low = wanting.get(name)
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
								<PantrySprite
									look={resolveSpriteLook(name, null, section.id)}
									className="size-9 shrink-0"
								/>
								<span className="flex min-w-0 flex-1 flex-col leading-tight">
									<span>{name}</span>
									{low ? (
										<span className="text-muted-foreground text-xs">
											{low.level === 'out' ? 'out' : 'running low'}
										</span>
									) : null}
								</span>
								{on || have ? (
									<Check
										size={16}
										weight="bold"
										aria-hidden
										className="shrink-0"
									/>
								) : null}
								{have ? <span className="sr-only">, already kept</span> : null}
							</button>
						</li>
					)
				})}
				{/* The catalog's own matches first; what was typed, last. */}
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
			</ul>

			{shown.length === 0 && !canAddTyped ? (
				<p className="text-muted-foreground text-sm">nothing matches</p>
			) : null}

			<div className="border-border bg-card fixed inset-x-0 bottom-0 z-40 border-t p-3 md:left-48">
				<div className="flex max-w-3xl items-center gap-3 px-3 md:px-7">
					<p
						aria-live="polite"
						className="text-muted-foreground flex-1 text-xs font-semibold"
					>
						{selected.size ? `${selected.size} picked` : 'tap what you have'}
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
						className={buttonVariants()}
					>
						{pending
							? 'adding…'
							: selected.size
								? `add ${selected.size}`
								: 'add'}
					</button>
				</div>
			</div>
		</>
	)
}
