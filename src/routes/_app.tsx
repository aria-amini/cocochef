import {
	createFileRoute,
	Outlet,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { Activity, Suspense, useEffect, useLayoutEffect, useState } from 'react'

import { AppChrome } from '@/components/app-chrome'
import {
	type KeptRoute,
	keptPaths,
	keptRoutes,
	keptScroll,
	takeTabJump,
} from '@/lib/kept-match'

export const Route = createFileRoute('/_app')({ component: AppLayout })

// The three tabs stay alive once opened: leaving one hides it rather than
// throwing it away, so going back to it is instant, with its list, its
// scroll and what was typed just as they were. Every other page, and a tab
// still loading or in error, is the router's as usual.
function AppLayout() {
	const router = useRouter()

	// The tab on screen. One already kept shows the moment its address is
	// asked for, from what it holds, while the router reads it again behind
	// it; one not yet kept shows once the router has loaded it.
	const asked = useRouterState({ select: (state) => state.location.pathname })

	const loaded = useRouterState({
		select: (state) => {
			const page = state.matches.at(-1)

			return page?.status === 'success'
				? keptRoutes.find((route) => route === page.routeId)
				: undefined
		},
	})

	// Each tab is kept from its first showing on.
	const [kept, setKept] = useState<readonly KeptRoute[]>([])

	if (loaded && !kept.includes(loaded)) setKept([...kept, loaded])

	// A kept tab whose reload failed gives way to the router's own page,
	// which says so and offers to try again.
	const failed = useRouterState({
		select: (state) => state.matches.at(-1)?.status === 'error',
	})

	const waiting = failed
		? undefined
		: kept.find((route) => keptPaths[route] === asked)

	const shown = waiting ?? loaded

	// The tab on screen notes where it is scrolled to, for its next showing.
	useEffect(() => {
		if (!shown) return

		const note = () => keptScroll.set(shown, window.scrollY)

		window.addEventListener('scroll', note, { passive: true })

		return () => window.removeEventListener('scroll', note)
	}, [shown])

	// Opened from its tab button, a tab lands where it was left, before the
	// screen is drawn.
	useLayoutEffect(() => {
		if (shown && takeTabJump())
			window.scrollTo({ top: keptScroll.get(shown) ?? 0, behavior: 'instant' })
	}, [shown])

	return (
		<AppChrome>
			{kept.map((route) => {
				const Page = router.routesById[route].options.component

				return (
					<Activity key={route} mode={route === shown ? 'visible' : 'hidden'}>
						<Suspense fallback={null}>{Page ? <Page /> : null}</Suspense>
					</Activity>
				)
			})}
			{shown ? null : <Outlet />}
		</AppChrome>
	)
}
