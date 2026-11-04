import { defineToolkit } from '@aamini/config/tanstack'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
// Loading the Varlock plugin resolves the env into process.env, so the
// SENTRY_AUTH_TOKEN read below sees deployed secrets.
import '@varlock/vite-integration'

export default defineToolkit({
	root: import.meta.dirname,
	tests: {
		server: {
			include: ['src/**/*.{server,db}.test.ts', 'src/**/db.test.ts'],
			testTimeout: 10_000,
			globalSetup: ['./tests/support/db.global-setup.ts'],
		},
	},
	config: {
		fmt: {
			ignorePatterns: (preset) => [
				...preset,
				'src/db/migrations/**',
				'src/lib/discover/catalog.json',
			],
		},
		lint: {
			rules: {
				// The theme declares leading-poster in @theme inline, but the rule
				// cannot resolve values declared that way, so it is allow-listed by
				// name.
				'shadcn/no-unknown-classes': ['error', { allow: ['leading-poster'] }],
			},
		},
		plugins: [
			sentryTanstackStart({
				org: 'aamini-stack',
				project: 'dutch-oven',
				authToken: process.env.SENTRY_AUTH_TOKEN ?? '',
				telemetry: Boolean(process.env.SENTRY_AUTH_TOKEN),
				silent: !process.env.CI,
				tunnelRoute: true,
				sourcemaps: {
					// The default `./**/*.map` skips dot directories, so it never
					// matched the public maps under .output.
					filesToDeleteAfterUpload: ['.output/public/**/*.map'],
				},
			}),
		],
	},
})
