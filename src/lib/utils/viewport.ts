import { useEffect } from 'react'

// A full-screen panel on a phone stays full height when the on-screen keyboard
// opens: the keyboard slides over its bottom, rather than the panel shrinking
// a beat behind it and redrawing. While `active`, this publishes how much of
// the screen the keyboard covers as `--keyboard-inset`, for scroll areas to
// pad their ends by, so nothing is left out of reach beneath it. The default,
// for no keyboard, lives in styles.css.
export function useKeyboardInset(active: boolean) {
	useEffect(() => {
		const viewport = window.visualViewport

		if (!active || !viewport) return

		const root = document.documentElement.style

		const update = () => {
			const covered = Math.max(
				0,
				window.innerHeight - viewport.height - viewport.offsetTop,
			)

			root.setProperty('--keyboard-inset', `${Math.round(covered)}px`)
		}

		update()
		viewport.addEventListener('resize', update)
		viewport.addEventListener('scroll', update)

		return () => {
			viewport.removeEventListener('resize', update)
			viewport.removeEventListener('scroll', update)
			root.removeProperty('--keyboard-inset')
		}
	}, [active])
}
