import { useEffect } from 'react'

// Phones keep the layout viewport at full height when the on-screen keyboard
// opens (`100dvh` does not shrink), so a tall fixed panel ends up behind it.
// While `active`, this publishes the visible area as CSS variables the panel can
// size itself with: `--vv-top` and `--vv-height` for the area, and `--vv-gap`
// for the space to leave above the panel, which tightens when the keyboard is up.
export function useVisualViewportVars(active: boolean) {
	useEffect(() => {
		const viewport = window.visualViewport

		if (!active || !viewport) return

		const root = document.documentElement.style

		const update = () => {
			const keyboard = window.innerHeight - viewport.height > 120

			root.setProperty('--vv-top', `${viewport.offsetTop}px`)
			root.setProperty('--vv-height', `${viewport.height}px`)
			root.setProperty('--vv-gap', keyboard ? '0.5rem' : '1rem')
		}

		update()
		viewport.addEventListener('resize', update)
		viewport.addEventListener('scroll', update)

		return () => {
			viewport.removeEventListener('resize', update)
			viewport.removeEventListener('scroll', update)
			root.removeProperty('--vv-top')
			root.removeProperty('--vv-height')
			root.removeProperty('--vv-gap')
		}
	}, [active])
}
