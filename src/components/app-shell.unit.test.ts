import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test } from 'vite-plus/test'

// Pages live in `_app/`, which wraps them in the app shell: sidebar, tab bar
// and header. These are the only routes that are deliberately outside it. A new
// route outside `_app/` fails here, so leaving the shell is a decision, not a
// slip. To skip the tab bar inside the shell, set `staticData.tabBar` instead.
const outsideShell = [
	'__root.tsx',
	'_app.tsx',
	'$handle.index.tsx', // a public profile has its own plain header
	'auth/login.tsx',
	'auth/signup.tsx',
	'api/auth.$.ts',
	'api/health.ts',
	'api/oven.ts',
]

function routeFiles(dir: string, prefix = ''): string[] {
	return readdirSync(join(import.meta.dirname, dir), {
		withFileTypes: true,
	}).flatMap((entry) => {
		const path = `${prefix}${entry.name}`

		if (entry.isDirectory())
			return entry.name === '_app' || entry.name.startsWith('__')
				? []
				: routeFiles(join(dir, entry.name), `${path}/`)

		return /\.(test|unit\.test)\.tsx?$/.test(entry.name) ||
			entry.name === 'routeTree.gen.ts'
			? []
			: [path]
	})
}

test('every page route sits inside the app shell unless listed here', () => {
	expect(routeFiles('../routes').sort()).toEqual([...outsideShell].sort())
})
