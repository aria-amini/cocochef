import type { RecipeContent } from '@/lib/recipes/model'

export type SaveState = 'saved' | 'saving' | 'unnamed' | 'failed'

const autosaveDelayMs = 600

// Saves a moment after each change, one save at a time, and only when the form
// differs from what was last saved. `save` returns the id it saved to: a new
// recipe gets one on its first save.
export function createAutosaver({
	read,
	save,
	report,
}: {
	read: () => RecipeContent | undefined
	save: (content: RecipeContent) => Promise<void>
	report: (state: SaveState) => void
}) {
	let saved: string | undefined
	// The form's content when it was last read, for a save after it is gone.
	let last: RecipeContent | undefined
	let timer: ReturnType<typeof setTimeout> | undefined
	let inFlight: Promise<void> | undefined
	let paused = false
	let stopped = false
	// After the editor is gone, a failed save is not tried again on a timer.
	let detached = false

	async function flush(): Promise<boolean> {
		clearTimeout(timer)

		if (paused || stopped) return true

		const content = read() ?? last

		if (!content) {
			report('unnamed')

			return false
		}

		const snapshot = JSON.stringify(content)

		if (snapshot === saved) {
			report('saved')

			return true
		}

		// Wait out the save in flight, then look again: it may have covered this.
		if (inFlight) {
			await inFlight.catch(() => undefined)

			return flush()
		}

		report('saving')
		inFlight = save(content)

		try {
			await inFlight
			saved = snapshot
		} catch {
			report('failed')

			if (!detached) timer = setTimeout(() => void flush(), autosaveDelayMs * 5)

			return false
		} finally {
			inFlight = undefined
		}

		return flush()
	}

	return {
		flush,
		schedule: () => {
			clearTimeout(timer)
			timer = setTimeout(() => void flush(), autosaveDelayMs)
		},
		// What the editor opened with counts as saved, if it exists to be saved.
		start: (persisted: boolean) => {
			detached = false
			saved = persisted ? JSON.stringify(read()) : undefined
		},
		// Keeps the form's content for the save that runs after it unmounts.
		remember: () => {
			last = read()
		},
		// Resolves once the save in flight, if any, has finished.
		settle: async () => {
			await inFlight?.catch(() => undefined)
		},
		// While a photo uploads its key is not ready to save.
		pause: (busy: boolean) => {
			paused = busy
		},
		stop: () => {
			stopped = true
			clearTimeout(timer)
		},
		// For when what stopped it did not go ahead.
		resume: () => {
			stopped = false
		},
		// The editor is leaving: one last save, with no retries behind it.
		detach: () => {
			detached = true
			clearTimeout(timer)
		},
		// The persisted copy was removed; identical content must save again.
		forget: () => {
			saved = undefined
		},
		savedSnapshot: () => saved,
	}
}
