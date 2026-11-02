import { spawnSync } from 'node:child_process'

import { describe, expect, test } from 'vite-plus/test'

// Runs varlock's real response guard, which tests that mock `serverEnv` skip.
// `env -i` gives the child a clean env: vitest sets values such as BASE_URL="/" that
// would override .env.test and fail varlock's validation.
function respondWith(variable: string) {
	const script = `import 'varlock/auto-load'; new Response(process.env.${variable})`

	return spawnSync(
		'env',
		[
			'-i',
			`PATH=${process.env.PATH ?? ''}`,
			'APP_ENV=test',
			'node_modules/.bin/varlock',
			'run',
			'--',
			'node',
			'--input-type=module',
			'-e',
			script,
		],
		{ encoding: 'utf8' },
	)
}

describe('storage credentials in responses', () => {
	test('lets the access key ID out, since presigned upload URLs carry it', () => {
		const result = respondWith('AWS_ACCESS_KEY_ID')

		expect(result.stderr).not.toContain('LEAKED SENSITIVE CONFIG')
		expect(result.status).toBe(0)
	})

	test('never lets the secret access key out', () => {
		const result = respondWith('AWS_SECRET_ACCESS_KEY')

		expect(result.stderr).toContain('LEAKED SENSITIVE CONFIG')
		expect(result.status).not.toBe(0)
	})
})
