import {
	CopyIcon,
	ExportIcon,
	PlusIcon,
	ShoppingCartIcon,
	XIcon,
} from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

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

const haveKey = (recipeId: string) => `cocochef:have:${recipeId}`

const haveLines = z.array(z.string()).catch([])

// Storage may be missing or refuse (a private window); the list still works,
// it just forgets.
function stored(key: string) {
	try {
		return window.localStorage.getItem(key)
	} catch {
		return null
	}
}

function store(key: string, value: string | null) {
	try {
		if (value === null) window.localStorage.removeItem(key)
		else window.localStorage.setItem(key, value)
	} catch {
		// Remembering is a convenience.
	}
}

// The lines of a recipe the cook already has, remembered on this device so a
// trip to the fridge and back keeps the ticks.
export function useHave(recipeId: string) {
	const [have, setHave] = useState<ReadonlySet<string>>(() => new Set())

	// Read when shopping starts, so the page renders the same on the server.
	function load() {
		const saved = stored(haveKey(recipeId))

		try {
			setHave(new Set(haveLines.parse(saved ? JSON.parse(saved) : [])))
		} catch {
			setHave(new Set())
		}
	}

	const toggle = (line: string) =>
		setHave((current) => {
			const next = new Set(current)

			if (next.has(line)) next.delete(line)
			else next.add(line)

			store(haveKey(recipeId), next.size ? JSON.stringify([...next]) : null)

			return next
		})

	return { have, load, toggle }
}

const pillActionClassName = buttonVariants({
	variant: 'ghost',
	className: 'rounded-full',
})

// What is left to buy, sent on: onto the groceries list, or as text for a
// message or a note.
export function GrocerySend({
	recipeId,
	title,
	lines,
	have,
}: {
	recipeId: string
	title: string
	lines: string[]
	have: ReadonlySet<string>
}) {
	const navigate = useNavigate()
	const client = useQueryClient()
	const items = groceryList(lines, have)
	const text = items.join('\n')
	const [adding, setAdding] = useState(false)
	// What will be added, shown to change before anything is saved.
	const [reviewing, setReviewing] = useState(false)
	// Shown only once the cook starts shopping, so only ever in the browser.
	const canShare = 'share' in navigator

	async function add(chosen: string[]) {
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
			setReviewing(false)
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
		// On a phone it floats above the tab bar, which stays, so the groceries
		// tab can say what landed.
		<div className="pb-bar max-md:bottom-fab pointer-events-none sticky bottom-0 z-10 flex justify-center pt-3 max-md:pb-0">
			<div
				role="toolbar"
				aria-label="send the grocery list"
				className="bg-card border-border pointer-events-auto flex max-w-full items-center gap-1 rounded-full border p-1.5 shadow-md"
			>
				<p
					aria-live="polite"
					className="text-muted-foreground min-w-0 truncate pr-1 pl-3 text-sm font-semibold"
				>
					{items.length ? `${items.length} to buy` : 'nothing to buy'}
				</p>
				<button
					type="button"
					aria-label="copy"
					title="copy the list"
					disabled={!items.length}
					onClick={copy}
					className={cn(pillActionClassName, 'px-3')}
				>
					<CopyIcon size={16} weight="bold" aria-hidden />
				</button>
				{canShare ? (
					<button
						type="button"
						aria-label="share"
						title="share the list"
						disabled={!items.length}
						onClick={share}
						className={cn(pillActionClassName, 'px-3')}
					>
						<ExportIcon size={16} weight="bold" aria-hidden />
					</button>
				) : null}
				<button
					type="button"
					disabled={!items.length}
					onClick={() => setReviewing(true)}
					className={buttonVariants({ className: 'rounded-full px-5' })}
				>
					<ShoppingCartIcon size={16} weight="bold" aria-hidden />
					add to groceries
				</button>
			</div>
			{reviewing ? (
				<AddReview
					title={title}
					items={items}
					adding={adding}
					onClose={() => setReviewing(false)}
					onAdd={(chosen) => void add(chosen)}
				/>
			) : null}
		</div>
	)
}

type Draft = { id: string; text: string; on: boolean }

const draftOf = (text: string): Draft => ({
	id: crypto.randomUUID(),
	text,
	on: true,
})

// What a recipe would add, to change before it goes on the list: a line's
// words, whether it goes, and any line the recipe forgot.
function AddReview({
	title,
	items,
	adding,
	onClose,
	onAdd,
}: {
	title: string
	items: string[]
	adding: boolean
	onClose: () => void
	onAdd: (chosen: string[]) => void
}) {
	const [drafts, setDrafts] = useState(() => items.map(draftOf))
	const [extra, setExtra] = useState('')

	const chosen = drafts.flatMap((draft) =>
		draft.on && draft.text.trim() ? [draft.text.trim()] : [],
	)

	const change = (id: string, patch: Partial<Draft>) =>
		setDrafts((current) =>
			current.map((draft) =>
				draft.id === id ? { ...draft, ...patch } : draft,
			),
		)

	function addExtra() {
		const text = extra.trim()

		if (!text) return
		setDrafts((current) => [...current, draftOf(text)])
		setExtra('')
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[85dvh] flex-col">
				<DialogHeader>
					<DialogTitle>add to groceries</DialogTitle>
					<DialogDescription>
						from {title}. change a line, or untick what you do not need.
					</DialogDescription>
				</DialogHeader>
				<ul
					aria-label="items to add"
					className="divide-border border-input -mx-1 min-h-0 flex-1 divide-y overflow-y-auto rounded-xl border"
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
						onClick={() => onAdd(chosen)}
						className={buttonVariants()}
					>
						{adding ? 'adding…' : `add ${chosen.length}`}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
