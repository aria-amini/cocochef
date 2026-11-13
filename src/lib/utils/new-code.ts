import type { AnyRouter } from '@tanstack/react-router'

const lastReload = 'cocochef:reloaded-for-new-code'

// Opens `href` as a full page load, unless this tab just did that for the same
// address: a deploy that is broken itself must not reload the tab forever.
function loadWhole(href: string) {
	try {
		const [at, previous] = JSON.parse(
			sessionStorage.getItem(lastReload) ?? '[0, ""]',
		)

		if (previous === href && Date.now() - at < 5_000) return

		sessionStorage.setItem(lastReload, JSON.stringify([Date.now(), href]))
	} catch {
		// Without storage, a reload still beats a page that never opens.
	}

	window.location.assign(href)
}

// A deploy replaces the app's code files, and a tab opened before it still
// asks for the old ones, which are gone, so the page it was opening never
// shows. TanStack Router reloads for this only once per error message in a
// tab, and Safari's message is the same for every file, so an iPhone tab
// stayed broken from its second deploy on. Once a file fails, the page being
// opened, and every one after it, opens as a full load with the new code.
export function loadNewCodeAfterDeploys(router: AnyRouter) {
	let stale = false

	window.addEventListener('vite:preloadError', () => {
		stale = true

		// A navigation under way already has its address in the bar.
		if (router.state.status === 'pending') loadWhole(router.state.location.href)
	})

	router.subscribe('onBeforeNavigate', ({ toLocation }) => {
		if (stale) loadWhole(toLocation.href)
	})
}
