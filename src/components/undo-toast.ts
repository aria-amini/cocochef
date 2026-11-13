import { toast } from 'sonner'

// A change that can be taken back: said near the thumb, at the bottom, and
// held long enough to reach for. The change itself is already made; undo
// makes it again the other way.
export function undoToast(message: string, onUndo: () => void) {
	let undone = false

	toast(message, {
		position: 'bottom-center',
		duration: 8000,
		action: {
			label: 'undo',
			onClick: () => {
				if (undone) return
				undone = true
				onUndo()
			},
		},
	})
}
