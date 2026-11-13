import { type ExternalToast, toast } from 'sonner'

// A change that can be taken back: said near the thumb, at the bottom, and
// held long enough to reach for. The change itself is already made; undo
// makes it again the other way. Toasts that share an id replace one another,
// so a run of changes says only the last.
export function undoToast(message: string, onUndo: () => void, id?: string) {
	let undone = false

	const options: ExternalToast = {
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
	}

	if (id) options.id = id

	toast(message, options)
}
