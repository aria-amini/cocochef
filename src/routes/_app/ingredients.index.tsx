import { Dialog } from '@base-ui/react/dialog'
import { Minus, Plus, X } from '@phosphor-icons/react'
import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
} from '@tanstack/react-router'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { BackLink, PageTitle } from '@/components/page'
import type { pantryItems } from '@/db/schema'
import { categorySprites, findCatalogSection } from '@/lib/pantry/catalog'
import {
	pantryCategories,
	pantryCategoryLabels,
	pantryQuantityMax,
	pantrySearch,
	type PantryCategory,
} from '@/lib/pantry/model'
import {
	deletePantryItem,
	listPantry,
	setPantryItemQuantity,
} from '@/lib/pantry/server'
import { resolveSpriteSrc } from '@/lib/pantry/sprites'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/ingredients/')({
	validateSearch: pantrySearch,
	loader: () => listPantry(),
	component: Pantry,
})

type PantryItem = typeof pantryItems.$inferSelect

const dateFormat = new Intl.DateTimeFormat('en', {
	month: 'short',
	day: 'numeric',
})

const emptyPreview: PantryCategory[] = [
	'spices',
	'meat',
	'dairy',
	'vegetables',
	'fruit',
	'grains',
]

// Bulk add opens straight into a category when the catalog has one for it.
function bulkSearch(category: PantryCategory | undefined) {
	return { cat: findCatalogSection(category)?.id }
}

function Pantry() {
	const navigate = useNavigate()

	const wide = useSyncExternalStore(
		subscribeWide,
		() => matchMedia('(min-width: 1024px)').matches,
		() => true,
	)

	const items = Route.useLoaderData()
	const { cat, item: selectedId } = Route.useSearch()

	const stocked = pantryCategories.filter((category) =>
		items.some((item) => item.category === category),
	)

	const groups = (cat ? [cat] : stocked).map((category) => ({
		category,
		items: items.filter((item) => item.category === category),
	}))

	const visible = groups.flatMap((group) => group.items)

	const selected =
		visible.find((i) => i.id === selectedId) ?? visible[0] ?? null

	return (
		<main className="flex-1">
			<div className="flex max-w-5xl flex-col gap-6 p-6 md:p-10">
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<BackLink to="/recipes" className="mb-2 hidden md:inline-flex">
							recipes
						</BackLink>
						<PageTitle>ingredients</PageTitle>
					</div>
					{groups.length > 0 ? (
						<Link
							to="/ingredients/bulk"
							search={bulkSearch(cat)}
							className="bg-kitchen-yolk inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition-colors hover:brightness-95"
						>
							<Plus size={18} weight="bold" aria-hidden />
							add
						</Link>
					) : null}
				</header>

				{stocked.length > 1 ? (
					<nav aria-label="Categories" className="flex flex-wrap gap-2">
						{stocked.map((category) => {
							const active = category === cat

							return (
								<Link
									key={category}
									to="/ingredients"
									search={{ cat: active ? undefined : category }}
									aria-current={active ? 'true' : undefined}
									className={cn(
										'flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition-colors rounded-md',
										active
											? 'border-border bg-kitchen-yolk/40'
											: 'border-foreground/30 hover:border-input',
									)}
								>
									<img
										src={`/sprites/pantry/${categorySprites[category]}.png`}
										alt=""
										className="size-4 [image-rendering:pixelated]"
									/>
									{pantryCategoryLabels[category]}
								</Link>
							)
						})}
					</nav>
				) : null}

				{groups.length === 0 ? (
					<section className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border p-10 text-center">
						<div aria-hidden className="flex gap-3">
							{emptyPreview.map((category) => (
								<img
									key={category}
									src={`/sprites/pantry/${categorySprites[category]}.png`}
									alt=""
									className="size-10 [image-rendering:pixelated]"
								/>
							))}
						</div>
						<p className="text-lg font-bold">nothing here yet</p>
						<Link
							to="/ingredients/bulk"
							className="bg-kitchen-yolk flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold"
						>
							<Plus size={14} weight="bold" aria-hidden />
							stock up
						</Link>
					</section>
				) : (
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
						<div className="border-border bg-card flex flex-1 flex-col gap-5 rounded-xl border p-3 md:p-4">
							{groups.map((group) => (
								<section
									key={group.category}
									aria-label={pantryCategoryLabels[group.category]}
								>
									<h2 className="mb-2 flex items-center gap-2 text-xs font-semibold">
										{pantryCategoryLabels[group.category]}
										<span className="text-muted-foreground font-mono">
											{group.items.length}
										</span>
									</h2>
									<div className="grid grid-cols-4 gap-2 md:grid-cols-8">
										{group.items.map((item) => (
											<Slot
												key={item.id}
												item={item}
												cat={cat}
												selected={item.id === selected?.id}
											/>
										))}
										<Link
											to="/ingredients/bulk"
											search={bulkSearch(group.category)}
											aria-label={`Add ${pantryCategoryLabels[group.category]}`}
											className="border-foreground/40 hover:border-input hover:text-foreground text-foreground/50 flex aspect-square items-center justify-center rounded-xl border border-dashed transition-colors"
										>
											<Plus size={22} weight="bold" aria-hidden />
										</Link>
									</div>
								</section>
							))}
						</div>

						<DetailPanel
							item={selected}
							className="hidden lg:block lg:w-80 lg:shrink-0"
						/>
					</div>
				)}
			</div>

			{!wide && selectedId && selected ? (
				<Dialog.Root
					open
					onOpenChange={(open) => {
						if (!open) void navigate({ to: '/ingredients', search: { cat } })
					}}
				>
					<Dialog.Portal>
						<Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50" />
						<Dialog.Popup
							aria-describedby={undefined}
							className="bg-card fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto outline-none"
						>
							<Dialog.Title className="sr-only">
								Ingredient details
							</Dialog.Title>
							<Dialog.Close
								aria-label="Close details"
								className="border-border bg-background absolute top-3 right-3 rounded-md border p-2"
							>
								<X size={18} aria-hidden />
							</Dialog.Close>
							<DetailPanel item={selected} />
						</Dialog.Popup>
					</Dialog.Portal>
				</Dialog.Root>
			) : null}
		</main>
	)
}

function subscribeWide(notify: () => void) {
	const query = matchMedia('(min-width: 1024px)')
	query.addEventListener('change', notify)

	return () => query.removeEventListener('change', notify)
}

function Slot({
	item,
	cat,
	selected,
}: {
	item: PantryItem
	cat: PantryCategory | undefined
	selected: boolean
}) {
	return (
		<Link
			to="/ingredients"
			search={{ cat, item: item.id }}
			aria-label={`${item.name}, quantity ${item.quantity}`}
			aria-current={selected ? 'true' : undefined}
			className={cn(
				'relative flex aspect-square items-center justify-center border p-1 transition-colors rounded-xl',
				selected
					? 'border-border bg-kitchen-yolk/40'
					: 'border-foreground/30 bg-card hover:border-input',
			)}
		>
			<img
				src={resolveSpriteSrc(item.name, item.spriteKey, item.category)}
				alt=""
				className="size-10 object-contain [image-rendering:pixelated] md:size-12"
			/>
			<span className="sr-only">{item.name}</span>
			<span className="bg-foreground text-background absolute right-0.5 bottom-0.5 px-1 font-mono text-xs leading-4 font-semibold">
				{item.quantity}
			</span>
		</Link>
	)
}

function DetailPanel({
	item,
	className = '',
}: {
	item: PantryItem | null
	className?: string
}) {
	const router = useRouter()
	const navigate = useNavigate()
	const [pending, setPending] = useState(false)

	async function changeQuantity(itemId: string, quantity: number) {
		setPending(true)

		try {
			await setPantryItemQuantity({ data: { id: itemId, quantity } })
			await router.invalidate()
		} catch {
			toast.error("couldn't update the quantity — try again")
		} finally {
			setPending(false)
		}
	}

	async function remove(itemId: string) {
		setPending(true)

		try {
			await deletePantryItem({ data: { id: itemId } })
			await navigate({
				to: '/ingredients',
				search: (prev) => ({ cat: prev.cat }),
			})
			await router.invalidate()
		} catch {
			toast.error("couldn't remove that ingredient — try again")
		} finally {
			setPending(false)
		}
	}

	return (
		<aside
			aria-label="Item details"
			className={cn('border-border bg-card border p-5 rounded-xl', className)}
		>
			{item ? (
				<div className="flex flex-col items-center gap-4">
					<img
						src={resolveSpriteSrc(item.name, item.spriteKey, item.category)}
						alt=""
						className="size-20 object-contain [image-rendering:pixelated]"
					/>
					<h2 className="text-2xl font-bold tracking-tight lowercase">
						{item.name}
					</h2>
					<div className="flex items-center gap-3">
						<button
							type="button"
							aria-label="Decrease quantity"
							disabled={pending || item.quantity <= 1}
							onClick={() => changeQuantity(item.id, item.quantity - 1)}
							className="border-border bg-background hover:bg-kitchen-yolk/40 flex size-9 items-center justify-center rounded-md border disabled:opacity-40"
						>
							<Minus size={16} weight="bold" aria-hidden />
						</button>
						<p className="min-w-16 text-center font-mono text-2xl font-bold">
							× {item.quantity}
						</p>
						<button
							type="button"
							aria-label="Increase quantity"
							disabled={pending || item.quantity >= pantryQuantityMax}
							onClick={() => changeQuantity(item.id, item.quantity + 1)}
							className="border-border bg-background hover:bg-kitchen-yolk/40 flex size-9 items-center justify-center rounded-md border disabled:opacity-40"
						>
							<Plus size={16} weight="bold" aria-hidden />
						</button>
					</div>
					<dl className="text-muted-foreground border-foreground/20 w-full border-t pt-3 text-xs">
						<div className="flex justify-between py-0.5">
							<dt>category</dt>
							<dd className="text-foreground font-semibold">
								{pantryCategoryLabels[item.category]}
							</dd>
						</div>
						<div className="flex justify-between py-0.5">
							<dt>stashed</dt>
							<dd className="text-foreground font-semibold">
								{dateFormat.format(item.createdAt)}
							</dd>
						</div>
					</dl>
					<button
						type="button"
						disabled={pending}
						onClick={() => remove(item.id)}
						className="mt-1 text-xs font-semibold underline underline-offset-4 disabled:opacity-40"
					>
						use it up — remove it
					</button>
				</div>
			) : (
				<p className="text-muted-foreground py-8 text-center text-xs">
					pick a slot to see what&apos;s inside
				</p>
			)}
		</aside>
	)
}
