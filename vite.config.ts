import type { IncomingMessage, ServerResponse } from 'node:http'

import { defineToolkit } from '@aamini/config/tanstack'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
// Loading the Varlock plugin resolves the env into process.env, so the
// SENTRY_AUTH_TOKEN read below sees deployed secrets.
import '@varlock/vite-integration'
import type { Plugin } from 'vite-plus'
import { playwright } from 'vite-plus/test/browser-playwright'

// Class strings live in className, cn() and cva().
const classStrings =
	':matches(JSXAttribute[name.name="className"], CallExpression[callee.name=/^(cn|cva)$/])'

const designClassRules = [
	{
		selector: `${classStrings} Literal[value=/(^|[\\s:])(uppercase|capitalize)(\\s|$)/]`,
		message: 'All UI copy is lowercase: no uppercase or capitalize.',
	},
	{
		selector: `${classStrings} Literal[value=/(^|[\\s:])bg-(linear|radial|conic|gradient)/]`,
		message: 'No gradients: ingredient colors are flat tints.',
	},
]

// In dev, Nitro takes any request a browser marks as an image load for a
// static file unless Nitro itself owns the route, so /api/img (a Start route)
// answers 404 and recipe photos never show. Its API routes are never static
// files: say so before Nitro looks. It goes at the very front of the
// middleware stack, not in plugin order: after Vite restarts itself on a
// change, Nitro's own middleware can land ahead of a plugin's. Builds don't
// use this middleware.
const apiRoutesAreNotAssets: Plugin = {
	name: 'cocochef:api-routes-are-not-assets',
	apply: 'serve',
	configureServer(server) {
		server.middlewares.stack.unshift({
			route: '',
			handle: (
				req: IncomingMessage,
				_res: ServerResponse,
				next: () => void,
			) => {
				if (req.url?.startsWith('/api/'))
					req.headers['sec-fetch-dest'] = 'empty'
				next()
			},
		})
	},
}

export default defineToolkit({
	root: import.meta.dirname,
	tests: {
		browser: {
			// Spies on globals like fetch would otherwise leak into later tests.
			restoreMocks: true,
			browser: {
				// The app skips its entrance animations under reduced motion, so
				// captures never catch a page mid-fade. This repeats the toolkit's
				// launch options because the provider is replaced whole.
				provider: playwright({
					contextOptions: { reducedMotion: 'reduce' },
					launchOptions: {
						channel: 'chromium',
						args: ['--disable-lcd-text', '--headless=new'],
					},
					actionTimeout: 3_000,
				}),
			},
		},
		server: {
			include: ['src/**/*.{server,db}.test.ts', 'src/**/db.test.ts'],
			testTimeout: 10_000,
			globalSetup: ['./tests/support/db.global-setup.ts'],
		},
	},
	config: {
		test: {
			// Outside a terminal (CI, an agent's command view) a reporter that
			// redraws in place prints each redraw again, so each test gets one
			// line there instead, as it finishes.
			reporters: process.stdout.isTTY
				? ['default']
				: [['verbose', { summary: false }]],
			// Browser tests run with reduced motion on purpose, and Framer Motion
			// says so once per page; nothing to act on.
			onConsoleLog: (log: string) =>
				!log.includes('You have Reduced Motion enabled on your device'),
		},
		fmt: {
			ignorePatterns: (preset) => [...preset, 'src/db/migrations/**'],
		},
		lint: {
			rules: {
				// The theme declares leading-poster in @theme inline, but the rule
				// cannot resolve values declared that way, so it is allow-listed by
				// name.
				'shadcn/no-unknown-classes': ['error', { allow: ['leading-poster'] }],
				// The look's class-level rules. The theme in src/styles.css
				// allowlists shadows and tracking; these cover what a theme cannot
				// remove. Appended to the toolkit's own className rule.
				'eslint-js/no-restricted-syntax': (current) =>
					Array.isArray(current) ? [...current, ...designClassRules] : current,
			},
		},
		plugins: [
			apiRoutesAreNotAssets,
			sentryTanstackStart({
				org: 'aamini-stack',
				project: 'dutch-oven',
				authToken: process.env.SENTRY_AUTH_TOKEN ?? '',
				telemetry: Boolean(process.env.SENTRY_AUTH_TOKEN),
				silent: !process.env.CI,
				// No tunnelRoute: its generated route reached the client bundle
				// with all of Sentry. The tunnel is src/routes/api/oven.ts.
				sourcemaps: {
					// The default `./**/*.map` skips dot directories, so it never
					// matched the public maps under .output.
					filesToDeleteAfterUpload: ['.output/public/**/*.map'],
				},
			}),
		],
	},
})
