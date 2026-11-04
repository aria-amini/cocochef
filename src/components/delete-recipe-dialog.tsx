import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

// The one way a recipe leaves the shelf: from the saved bookmark and from the
// editor's delete. A recipe from the web only comes off this cook's shelf; one
// they wrote is gone.
export function DeleteRecipeDialog({
	open,
	onOpenChange,
	title,
	shared,
	pending,
	onConfirm,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	shared: boolean
	pending: boolean
	onConfirm: () => void
}) {
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
				<DialogFooter>
					<Button
						variant="outline"
						disabled={pending}
						onClick={() => onOpenChange(false)}
					>
						keep it
					</Button>
					<Button variant="destructive" disabled={pending} onClick={onConfirm}>
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
