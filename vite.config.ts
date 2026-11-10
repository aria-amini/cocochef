import { defineToolkit } from '@aamini/config/tanstack'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
// Loading the Varlock plugin resolves the env into process.env, so the
// SENTRY_AUTH_TOKEN read below sees deployed secrets.
import '@varlock/vite-integration'
import { playwright } from 'vite-plus/test/browser-playwright'

// Class strings live in className, cn() and cva().
const classStrings =
	':matches(JSXAttribute[name.name="className"], CallExpression[callee.name=/^(cn|cva)$/])'

const designClassRules = [
	{
		selector: `${classStrings} Literal[value=/(^|[\\s:])(uppercase|capitalize)(\\s|$)/]`,
		message:
			'All UI copy is lowercase: no uppercase or capitalize (DESIGN.md).',
	},
	{
		selector: `${classStrings} Literal[value=/(^|[\\s:])bg-(linear|radial|conic|gradient)/]`,
		message: 'No gradients: ingredient colors are flat tints (DESIGN.md).',
	},
]

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
		// The pre-commit hook (.vite-hooks/pre-commit) fixes what it can in the
		// staged files before checking them.
		staged: {
			'*': 'vp check --fix',
		},
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
				// DESIGN.md's class-level rules. The theme in src/styles.css
				// allowlists shadows and tracking; these cover what a theme cannot
				// remove. Appended to the toolkit's own className rule.
				'eslint-js/no-restricted-syntax': (current) =>
					Array.isArray(current) ? [...current, ...designClassRules] : current,
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
