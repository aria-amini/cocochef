import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

// Asked before the editor closes on changes that were never saved, however
// it closes: cancel, back, a tab, a link. Staying is the safe answer, so it
// is the one that leads.
export function LeaveEditorDialog({
	open,
	onStay,
	onLeave,
}: {
	open: boolean
	onStay: () => void
	onLeave: () => void
}) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onStay()}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>leave without saving?</DialogTitle>
					<DialogDescription>
						your changes to this recipe haven&apos;t been saved. leaving throws
						them away.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onLeave}>
						discard changes
					</Button>
					<Button onClick={onStay}>keep editing</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
