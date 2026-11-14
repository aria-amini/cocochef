import * as Sentry from '@sentry/tanstackstart-react'
import { ENV } from 'varlock/env'

const dsn: string | undefined = import.meta.env.VITE_PUBLIC_SENTRY_DSN

if (dsn)
	Sentry.init({
		dsn,
		tunnel: '/api/oven',
		// Each traced page load or navigation times its requests and renders,
		// then sends them through the tunnel. In production a fifth of them
		// shows the same picture for a fifth of the work; previews and
		// development trace every one, for debugging.
		tracesSampleRate: ENV.APP_ENV === 'production' ? 0.2 : 1.0,
		enableLogs: true,
	})
