import '@tests/support/mocks/browser'
import { QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
	type AnyRouter,
} from '@tanstack/react-router'
import { setMockSession, type MockSession } from '@tests/support/mocks/browser'
import { Toaster } from 'sonner'
import { render, type RenderResult } from 'vitest-browser-react'

import { pendingOptions } from '@/components/page-pending'

import { createTestQueryClient } from './component'

type RouteTarget =
	| { path: string; name?: string }
	| { path?: undefined; name: string }

export type RouteTestOptions = RouteTarget & {
	session?: MockSession
	setup?: () => Promise<void> | void
}

type RenderedRoute = {
	router: AnyRouter
	screen: RenderResult
	queryClient: ReturnType<typeof createTestQueryClient>
}

function resolveRoutePath({ path, name }: RouteTestOptions) {
	if (path) return path

	if (name) return `/${name}`
	throw new Error('Expected either path or name for route test')
}

export async function renderRoute(
	options: RouteTestOptions,
): Promise<RenderedRoute> {
	const path = resolveRoutePath(options)
	const queryClient = createTestQueryClient()

	setMockSession(options.session ?? null)
	await options.setup?.()

	const { routeTree } = await import('@/routeTree.gen')

	const router: AnyRouter = createRouter({
		routeTree,
		...pendingOptions,
		history: createMemoryHistory({ initialEntries: [path] }),
		scrollRestoration: false,
		defaultPreloadStaleTime: 0,
		context: { queryClient },
		Wrap: ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	})

	await router.load()

	localStorage.clear()
	document.body.replaceChildren()

	const container = document.body.appendChild(document.createElement('div'))
	container.style.width = '100vw'
	container.style.minHeight = '100vh'

	const screen = await render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
			{/* the app's Toaster lives in the document shell, which tests don't mount */}
			<Toaster position="top-right" />
		</QueryClientProvider>,
		{ container },
	)

	return { router, screen, queryClient }
}
