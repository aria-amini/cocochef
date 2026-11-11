import { CopyIcon, ExportIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
	startTransition,
	useOptimistic,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

import { groceryCountKey } from '@/components/grocery-badge'
import { PageTitle } from '@/components/page'
import { PantrySprite } from '@/components/pantry-sprite'
import { buttonVariants } from '@/components/ui/button'
import {
	addGroceries,
	clearCheckedGroceries,
	deleteGrocery,
	listGroceries,
	renameGrocery,
	setGroceryChecked,
} from '@/lib/groceries/server'
import { pantryCategoryLabels, type PantryCategory } from '@/lib/pantry/model'
import { ingredientItemLook } from '@/lib/pantry/sprites'
import { ingredientCategory } from '@/lib/recipes/ingredient-groups'
import { cn } from '@/lib/utils/ui'

export const Route = createFileRoute('/_app/groceries')({
	loader: () => listGroceries(),
	component: Groceries,
})

type Item = Awaited<ReturnType<typeof listGroceries>>[number]

type Change =
	| { kind: 'add'; items: Item[] }
	| { kind: 'check'; id: string; checked: boolean }
	| { kind: 'rename'; id: string; text: string }
	| { kind: 'remove'; id: string }
	| { kind: 'clear' }

// The list as it will be once a change lands, shown at once so a tick in the
// store never waits on the network.
function applyChange(items: Item[], change: Change): Item[] {
	switch (change.kind) {
		case 'add':
			return [...items, ...change.items]
		case 'check':
			return items.map((item) =>
				item.id === change.id
					? { ...item, checkedAt: change.checked ? new Date() : null }
					: item,
			)
		case 'rename':
			return items.map((item) =>
				item.id === change.id
					? {
							...item,
							text: change.text,
							category: ingredientCategory(change.text),
						}
					: item,
			)
		case 'remove':
			return items.filter((item) => item.id !== change.id)
		case 'clear':
			return items.filter((item) => !item.checkedAt)
	}
}

// One list for the shop: what is left, shelved by aisle, and what is already
// in the cart below it. Recipes add to it; anything else is typed in.
function Groceries() {
	const router = useRouter()
	const client = useQueryClient()
	const saved = Route.useLoaderData()
	const [items, apply] = useOptimistic(saved, applyChange)

	const waiting = items.filter((item) => !item.checkedAt)
	const inCart = items.filter((item) => item.checkedAt)

	function change(next: Change, send: () => Promise<void>) {
		startTransition(async () => {
			apply(next)

			try {
				await send()
			} catch {
				toast.error('could not update the list. try again')
			}

			await Promise.all([
				router.invalidate(),
				client.invalidateQueries({ queryKey: groceryCountKey }),
			])
		})
	}

	function add(text: string) {
		const draft: Item = {
			id: crypto.randomUUID(),
			userId: '',
			text,
			category: ingredientCategory(text),
			recipeId: null,
			recipeTitle: null,
			checkedAt: null,
			createdAt: new Date(),
		}

		change({ kind: 'add', items: [draft] }, async () => {
			await addGroceries({ data: [{ id: draft.id, text }] })
		})
	}

	const row = (item: Item) => (
		<GroceryRow
			key={item.id}
			item={item}
			onCheck={(checked) =>
				change({ kind: 'check', id: item.id, checked }, async () => {
					await setGroceryChecked({ data: { id: item.id, checked } })
				})
			}
			onRename={(text) =>
				change({ kind: 'rename', id: item.id, text }, async () => {
					await renameGrocery({ data: { id: item.id, text } })
				})
			}
			onRemove={() =>
				change({ kind: 'remove', id: item.id }, async () => {
					await deleteGrocery({ data: { id: item.id } })
				})
			}
		/>
	)

	return (
		<main className="flex-1">
			<div className="flex max-w-2xl flex-col gap-6 p-6 md:p-10">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<PageTitle>groceries</PageTitle>
						<p className="text-muted-foreground mt-1 text-sm font-semibold">
							{waiting.length
								? `${waiting.length} to buy`
								: inCart.length
									? 'all in the cart'
									: 'nothing to buy'}
						</p>
					</div>
					<SendList items={waiting.map((item) => item.text)} />
				</div>
				<AddItem onAdd={add} />
				{waiting.length ? (
					<div className="flex flex-col gap-5">
						{shelved(waiting).map(({ category, items: aisle }) => (
							<section
								key={category}
								aria-label={pantryCategoryLabels[category]}
							>
								<h2 className="text-muted-foreground px-1 pb-1 text-sm font-bold">
									{pantryCategoryLabels[category]}
								</h2>
								<ul className="bg-card border-input divide-border divide-y rounded-xl border">
									{aisle.map(row)}
								</ul>
							</section>
						))}
					</div>
				) : inCart.length ? null : (
					<p className="border-foreground/30 text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
						add what you need above, or open a{' '}
						<Link
							to="/recipes"
							className="text-foreground font-semibold underline"
						>
							recipe
						</Link>
						, tap <strong className="text-foreground">add to groceries</strong>{' '}
						and untick what you already have.
					</p>
				)}
				{inCart.length ? (
					<section aria-label="in the cart" className="flex flex-col gap-1">
						<div className="flex items-center justify-between px-1">
							<h2 className="text-muted-foreground text-sm font-bold">
								in the cart · {inCart.length}
							</h2>
							<button
								type="button"
								onClick={() =>
									change({ kind: 'clear' }, async () => {
										await clearCheckedGroceries()
									})
								}
								className={buttonVariants({
									variant: 'ghost',
									size: 'icon-sm',
									className: 'w-auto px-2.5',
								})}
							>
								clear
							</button>
						</div>
						<ul className="divide-border border-input divide-y rounded-xl border border-dashed">
							{inCart.map(row)}
						</ul>
					</section>
				) : null}
			</div>
		</main>
	)
}

// The aisles in the order of a walk through the shop: produce at the door,
// the fridges, the dry shelves, and the freezer last.
const aisles: PantryCategory[] = [
	'vegetables',
	'fruit',
	'meat',
	'dairy',
	'grains',
	'cans',
	'sauces',
	'spices',
	'other',
	'frozen',
]

function shelved(items: Item[]) {
	return aisles.flatMap((category) => {
		const aisle = items.filter((item) => item.category === category)

		return aisle.length ? [{ category, items: aisle }] : []
	})
}

// Typed items go in one after another: the field stays put and empties.
function AddItem({ onAdd }: { onAdd: (text: string) => void }) {
	const [text, setText] = useState('')

	function submit() {
		const trimmed = text.trim()

		if (!trimmed) return
		onAdd(trimmed)
		setText('')
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
			className="bg-card border-input focus-within:border-foreground/40 flex items-center gap-2 rounded-xl border pr-1.5 pl-3 transition-colors"
		>
			<PlusIcon
				size={18}
				weight="bold"
				aria-hidden
				className="text-muted-foreground"
			/>
			<input
				aria-label="add an item"
				placeholder="add an item"
				maxLength={200}
				value={text}
				onChange={(event) => setText(event.target.value)}
				enterKeyHint="done"
				className="placeholder:text-muted-foreground min-h-12 min-w-0 flex-1 bg-transparent text-base outline-none"
			/>
			{text.trim() ? (
				<button
					type="submit"
					className={buttonVariants({ className: 'min-h-9' })}
				>
					add
				</button>
			) : null}
		</form>
	)
}

function GroceryRow({
	item,
	onCheck,
	onRename,
	onRemove,
}: {
	item: Item
	onCheck: (checked: boolean) => void
	onRename: (text: string) => void
	onRemove: () => void
}) {
	const checked = !!item.checkedAt
	const look = ingredientItemLook(item.text)
	const field = useRef<HTMLInputElement>(null)

	function rename(text: string) {
		const trimmed = text.trim()

		if (!trimmed) {
			if (field.current) field.current.value = item.text

			return
		}

		if (trimmed !== item.text) onRename(trimmed)
	}

	return (
		<li className="group/item flex min-h-13 items-center gap-3 pr-1 pl-3">
			<input
				type="checkbox"
				aria-label={item.text}
				checked={checked}
				onChange={(event) => onCheck(event.target.checked)}
				className={cn(
					'border-foreground/40 grid size-6 shrink-0 cursor-pointer appearance-none place-items-center rounded-full border-2 transition-colors',
					'checked:bg-kitchen-basil checked:border-kitchen-basil',
					"checked:after:text-foreground checked:after:text-xs checked:after:font-bold checked:after:content-['✓']",
				)}
			/>
			<span aria-hidden className="grid size-6 shrink-0 place-items-center">
				{look ? <PantrySprite look={look} className="size-6" /> : null}
			</span>
			<span className="flex min-w-0 flex-1 flex-col py-2">
				<input
					ref={field}
					key={item.text}
					aria-label={`rename ${item.text}`}
					defaultValue={item.text}
					maxLength={200}
					onBlur={(event) => rename(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur()

						if (event.key === 'Escape') {
							event.currentTarget.value = item.text
							event.currentTarget.blur()
						}
					}}
					className={cn(
						'w-full min-w-0 bg-transparent text-base outline-none',
						checked && 'text-muted-foreground line-through',
					)}
				/>
				{item.recipeTitle ? (
					item.recipeId ? (
						<Link
							to="/recipes/$recipeId"
							params={{ recipeId: item.recipeId }}
							className="text-muted-foreground hover:text-foreground w-fit truncate text-xs"
						>
							{item.recipeTitle}
						</Link>
					) : (
						<span className="text-muted-foreground truncate text-xs">
							{item.recipeTitle}
						</span>
					)
				) : null}
			</span>
			<button
				type="button"
				aria-label={`remove ${item.text}`}
				onClick={onRemove}
				className="text-muted-foreground hover:text-foreground grid size-10 shrink-0 place-items-center rounded-full opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-60"
			>
				<XIcon size={14} weight="bold" aria-hidden />
			</button>
		</li>
	)
}

const noSubscription = () => () => {}

// The list as text, one item a line, for a message or a note.
function SendList({ items }: { items: string[] }) {
	const text = items.join('\n')

	// Known only in the browser; the server renders without it.
	const canShare = useSyncExternalStore(
		noSubscription,
		() => 'share' in navigator,
		() => false,
	)

	if (!items.length) return null

	return (
		<div className="flex gap-1">
			<button
				type="button"
				onClick={async () => {
					try {
						await navigator.clipboard.writeText(text)
						toast.success('copied the list')
					} catch {
						toast.error('could not copy the list')
					}
				}}
				className={buttonVariants({ variant: 'ghost' })}
			>
				<CopyIcon size={16} weight="bold" aria-hidden />
				copy
			</button>
			{canShare ? (
				<button
					type="button"
					onClick={async () => {
						try {
							await navigator.share({ title: 'groceries', text })
						} catch (error) {
							if (error instanceof DOMException && error.name === 'AbortError')
								return
							toast.error('could not share the list')
						}
					}}
					className={buttonVariants({ variant: 'outline' })}
				>
					<ExportIcon size={16} weight="bold" aria-hidden />
					share
				</button>
			) : null}
		</div>
	)
}
