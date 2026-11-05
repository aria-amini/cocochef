import * as Sentry from '@sentry/tanstackstart-react'
import { createRouter } from '@tanstack/react-router'

import { NotFoundComponent, ServerErrorComponent } from '@/components/errors'
import { pendingOptions } from '@/components/page-pending'
import { queryClient } from '@/lib/utils/query'

import { routeTree } from './routeTree.gen'

export const getRouter = () => {
	const router = createRouter({
		routeTree,
		...pendingOptions,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		context: { queryClient },
		defaultErrorComponent: ServerErrorComponent,
		defaultNotFoundComponent: NotFoundComponent,
	})

	if (!router.isServer) {
		Sentry.addIntegration(
			Sentry.tanstackRouterBrowserTracingIntegration(router),
		)
	}

	return router
}

declare module '@tanstack/react-router' {
	// Pages sit inside the app shell by default; a route says what it changes.
	interface StaticDataRouteOption {
		// 'none' when the page pins its own bottom actions; 'fab' for the shelf's
		// round add button.
		tabBar?: 'none' | 'fab'
		// 'none' when the page leads with its own back bar on phones.
		header?: 'none'
	}

	interface HistoryState {
		// A whole recipe pasted into the one box, for the new recipe page to sort.
		pasted?: string
	}
}
