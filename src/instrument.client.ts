import * as Sentry from '@sentry/tanstackstart-react'

const dsn: string | undefined = import.meta.env.VITE_PUBLIC_SENTRY_DSN

if (dsn) Sentry.init({ dsn, tracesSampleRate: 1.0, enableLogs: true })
