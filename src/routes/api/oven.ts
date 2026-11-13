import { createSentryTunnelRoute } from '@sentry/tanstackstart-react'
import { createFileRoute } from '@tanstack/react-router'

// Sentry's events from the browser, forwarded so ad blockers that refuse
// sentry.io let them through. The plugin's managed tunnel route is off: its
// generated route reached the client bundle and kept all of Sentry, Replay and
// Feedback included, about 390 KB. The name says nothing a blocklist matches.
export const Route = createFileRoute('/api/oven')({
	server: {
		handlers: {
			...createSentryTunnelRoute({}).handlers,
			// Any other method would render the whole app.
			GET: () =>
				new Response(null, { status: 405, headers: { Allow: 'POST' } }),
		},
	},
})
