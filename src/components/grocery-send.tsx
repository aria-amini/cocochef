import { CopyIcon, ExportIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { buttonVariants } from '@/components/ui/button'
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
	const items = groceryList(lines, have)
	const text = items.join('\n')
	const [adding, setAdding] = useState(false)
	// Shown only once the cook starts shopping, so only ever in the browser.
	const canShare = 'share' in navigator

	async function add() {
		setAdding(true)

		try {
			const added = await addGroceries({
				data: items.map((item) => ({
					text: item,
					recipeId,
					recipeTitle: title,
				})),
			})

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
		<div className="pb-bar pointer-events-none sticky bottom-0 z-10 flex justify-center pt-3">
			<div
				role="toolbar"
				aria-label="send the grocery list"
				className="bg-card border-border pointer-events-auto flex max-w-full items-center gap-1 rounded-full border p-1.5 shadow-xl"
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
					disabled={!items.length || adding}
					onClick={add}
					className={buttonVariants({ className: 'rounded-full px-5' })}
				>
					<ShoppingCartIcon size={16} weight="bold" aria-hidden />
					add to groceries
				</button>
			</div>
		</div>
	)
}
