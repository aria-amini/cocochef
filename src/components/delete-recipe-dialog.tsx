import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { recipeLinesGoing } from '@/lib/groceries/server'

// The one way a recipe leaves the shelf: from the saved bookmark and from the
// editor's delete. A recipe from the web only comes off this cook's shelf; one
// they wrote is gone. Its foods still waiting on the list can go with it,
// and do unless the cook says not: a recipe let go of is rarely still made.
export function DeleteRecipeDialog({
	open,
	onOpenChange,
	recipeId,
	title,
	shared,
	pending,
	onConfirm,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	recipeId: string | undefined
	title: string
	shared: boolean
	pending: boolean
	onConfirm: (groceries: boolean) => void
}) {
	const [groceries, setGroceries] = useState(true)
	const [wasOpen, setWasOpen] = useState(open)

	// Each time it opens, the offer starts ticked again.
	if (open !== wasOpen) {
		setWasOpen(open)

		if (open) setGroceries(true)
	}

	// Only the lines it would take: ones it made that no other recipe or the
	// cook's own typing has a claim on.
	const going = useQuery({
		queryKey: ['groceries', 'going', recipeId],
		queryFn: () => recipeLinesGoing({ data: { recipeId: recipeId ?? '' } }),
		enabled: open && !!recipeId,
		staleTime: 0,
	})

	const listed = going.data ?? 0

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>
						{shared ? 'remove' : 'delete'} {title || 'this recipe'}?
					</DialogTitle>
					<DialogDescription>
						{shared
							? 'it comes off your shelf, along with your notes. the recipe stays up for everyone else, and you can save it again.'
							: 'this deletes the recipe and your notes for good. there is no undo.'}
					</DialogDescription>
				</DialogHeader>
				{listed ? (
					<label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
						<input
							type="checkbox"
							checked={groceries}
							onChange={(event) => setGroceries(event.target.checked)}
							className="accent-kitchen-basil size-5 shrink-0"
						/>
						also take its {listed === 1 ? 'food' : `${listed} foods`} off your
						list
					</label>
				) : null}
				<DialogFooter>
					<Button
						variant="outline"
						disabled={pending}
						onClick={() => onOpenChange(false)}
					>
						keep it
					</Button>
					<Button
						variant="destructive"
						// Not before it knows whether there's anything to offer.
						disabled={pending || going.isFetching}
						onClick={() => onConfirm(!!listed && groceries)}
					>
						{pending
							? shared
								? 'removing…'
								: 'deleting…'
							: shared
								? 'remove'
								: 'delete'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
