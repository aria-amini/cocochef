import { useEffect, useState } from 'react'

// Past this far down, the page has scrolled enough to hide a bar.
const clearOfTop = 64

// A scroll this small either way is a wobble, not a direction.
const wobble = 6

// Whether a bar that rides the top of a phone's page should step aside:
// hidden while the cook scrolls down to read, back the moment they scroll up
// a little, and always shown near the top.
export function useScrollHidden() {
	const [hidden, setHidden] = useState(false)

	useEffect(() => {
		let last = window.scrollY
		let frame = 0

		const read = () => {
			frame = 0

			// Safari's bounce reports past either end; held to the page, its
			// spring back is no change of direction.
			const end = Math.max(
				0,
				document.documentElement.scrollHeight - window.innerHeight,
			)

			const now = Math.min(Math.max(window.scrollY, 0), end)
			const moved = now - last

			if (now < clearOfTop) setHidden(false)
			else if (moved > wobble) setHidden(true)
			else if (moved < -wobble) setHidden(false)
			else return

			last = now
		}

		const onScroll = () => {
			if (!frame) frame = window.requestAnimationFrame(read)
		}

		window.addEventListener('scroll', onScroll, { passive: true })

		return () => {
			window.removeEventListener('scroll', onScroll)

			if (frame) window.cancelAnimationFrame(frame)
		}
	}, [])

	return hidden
}
