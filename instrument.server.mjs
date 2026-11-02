import * as Sentry from '@sentry/tanstackstart-react'

Sentry.init({
	dsn: process.env.VITE_PUBLIC_SENTRY_DSN,
	tracesSampleRate: 1.0,
	enableLogs: true,
})
