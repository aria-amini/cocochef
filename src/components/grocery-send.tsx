import {
	CopyIcon,
	ExportIcon,
	PlusIcon,
	ShoppingCartIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { groceryCountKey, pulseGroceries } from '@/components/grocery-badge'
import { buttonVariants } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { fieldClassName, placeholderClassName } from '@/components/ui/input'
import { groceryList } from '@/lib/groceries/list'
import { addGroceries } from '@/lib/groceries/server'
import { cn } from '@/lib/utils/ui'

// A recipe's ingredients, sent to the groceries list: the cart opens what
// would be added, to untick what the kitchen has, change a line or add one,
// before anything goes on the list.
export function AddToGroceries({
	recipeId,
	title,
	lines,
}: {
	recipeId: string
	title: string
	lines: string[]
}) {
	const [open, setOpen] = useState(false)
	const items = groceryList(lines)

	if (!items.length) return null

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="border-input hover:bg-muted/60 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors"
			>
				<ShoppingCartIcon size={16} weight="bold" aria-hidden />
				add to groceries
			</button>
			{open ? (
				<GroceryReview
					recipeId={recipeId}
					title={title}
					items={items}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	)
}

type Draft = { id: string; text: string; on: boolean }

const draftOf = (text: string): Draft => ({
	id: crypto.randomUUID(),
	text,
	on: true,
})

const noSubscription = () => () => {}

function GroceryReview({
	recipeId,
	title,
	items,
	onClose,
}: {
	recipeId: string
	title: string
	items: string[]
	onClose: () => void
}) {
	const navigate = useNavigate()
	const client = useQueryClient()
	const [drafts, setDrafts] = useState(() => items.map(draftOf))
	const [extra, setExtra] = useState('')
	const [adding, setAdding] = useState(false)

	// Known only in the browser; the server renders without it.
	const canShare = useSyncExternalStore(
		noSubscription,
		() => 'share' in navigator,
		() => false,
	)

	const chosen = drafts.flatMap((draft) =>
		draft.on && draft.text.trim() ? [draft.text.trim()] : [],
	)

	const text = chosen.join('\n')

	const change = (id: string, patch: Partial<Draft>) =>
		setDrafts((current) =>
			current.map((draft) =>
				draft.id === id ? { ...draft, ...patch } : draft,
			),
		)

	function addExtra() {
		const line = extra.trim()

		if (!line) return
		setDrafts((current) => [...current, draftOf(line)])
		setExtra('')
	}

	async function add() {
		setAdding(true)

		try {
			const added = await addGroceries({
				data: chosen.map((item) => ({
					text: item,
					recipeId,
					recipeTitle: title,
				})),
			})

			// The groceries tab says how many landed, without leaving the recipe.
			pulseGroceries(added.length)
			void client.invalidateQueries({ queryKey: groceryCountKey })
			onClose()
			toast.success(
				added.length
					? `${added.length} added to groceries`
					: 'already on your groceries',
				{
					action: {
						label: 'open',
						onClick: () => void navigate({ to: '/groceries' }),
					},
				},
			)
		} catch {
			toast.error('could not add to groceries. try again')
		} finally {
			setAdding(false)
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(text)
			toast.success('copied the list')
		} catch {
			toast.error('could not copy the list')
		}
	}

	async function share() {
		try {
			await navigator.share({ title: `${title} groceries`, text })
		} catch (error) {
			// Closing the share sheet is not a failure.
			if (error instanceof DOMException && error.name === 'AbortError') return
			toast.error('could not share the list')
		}
	}

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="flex max-h-[85dvh] flex-col">
				<DialogHeader>
					<DialogTitle>add to groceries</DialogTitle>
					<DialogDescription>
						from {title}. untick what you have, or change a line.
					</DialogDescription>
				</DialogHeader>
				<ul
					aria-label="items to add"
					className="divide-border border-input min-h-0 flex-1 divide-y overflow-y-auto rounded-xl border"
				>
					{drafts.map((draft, index) => (
						<li key={draft.id} className="flex items-center gap-2 pr-1 pl-3">
							<input
								type="checkbox"
								aria-label={`add item ${index + 1}`}
								checked={draft.on}
								onChange={(event) =>
									change(draft.id, { on: event.target.checked })
								}
								className="accent-kitchen-basil size-5 shrink-0"
							/>
							<input
								aria-label={`item ${index + 1}`}
								value={draft.text}
								maxLength={200}
								onChange={(event) =>
									change(draft.id, { text: event.target.value })
								}
								className={cn(
									'min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none',
									!draft.on && 'text-muted-foreground line-through',
								)}
							/>
							<button
								type="button"
								aria-label={`remove ${draft.text.trim() || `item ${index + 1}`}`}
								onClick={() =>
									setDrafts((current) =>
										current.filter((other) => other.id !== draft.id),
									)
								}
								className="text-muted-foreground hover:text-foreground grid size-10 shrink-0 place-items-center rounded-full"
							>
								<XIcon size={14} weight="bold" aria-hidden />
							</button>
						</li>
					))}
				</ul>
				<form
					onSubmit={(event) => {
						event.preventDefault()
						addExtra()
					}}
					className="flex items-center gap-2"
				>
					<input
						aria-label="add another item"
						placeholder="add another item"
						maxLength={200}
						value={extra}
						onChange={(event) => setExtra(event.target.value)}
						className={cn(fieldClassName, placeholderClassName, 'flex-1')}
					/>
					<button
						type="submit"
						aria-label="put it on the list"
						disabled={!extra.trim()}
						className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
					>
						<PlusIcon size={14} weight="bold" aria-hidden />
					</button>
				</form>
				{/* The same list as text, for a message or a note. */}
				<div className="-mt-2 flex items-center gap-1">
					<span className="text-muted-foreground mr-1 text-xs font-semibold">
						as text
					</span>
					<button
						type="button"
						disabled={!chosen.length}
						onClick={copy}
						className={buttonVariants({
							variant: 'ghost',
							className: 'min-h-9 px-2.5',
						})}
					>
						<CopyIcon size={16} weight="bold" aria-hidden />
						copy
					</button>
					{canShare ? (
						<button
							type="button"
							disabled={!chosen.length}
							onClick={share}
							className={buttonVariants({
								variant: 'ghost',
								className: 'min-h-9 px-2.5',
							})}
						>
							<ExportIcon size={16} weight="bold" aria-hidden />
							share
						</button>
					) : null}
				</div>
				<DialogFooter>
					<button
						type="button"
						onClick={onClose}
						className={buttonVariants({ variant: 'outline' })}
					>
						cancel
					</button>
					<button
						type="button"
						disabled={!chosen.length || adding}
						onClick={() => void add()}
						className={buttonVariants()}
					>
						{adding ? 'adding…' : `add ${chosen.length}`}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
