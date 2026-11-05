import { describe, expect, test } from 'vite-plus/test'

import { legacyHostRedirect } from './legacy-host'

function request(host: string, path = '/', method = 'GET') {
	return new Request(`https://${host}${path}`, {
		method,
		headers: { host },
	})
}

describe('legacyHostRedirect', () => {
	test('sends the old production host to the current domain, keeping path and query', () => {
		const response = legacyHostRedirect(
			request('dutch-oven-production.up.railway.app', '/recipes/1?tab=notes'),
		)

		expect(response?.status).toBe(307)
		expect(response?.headers.get('location')).toBe(
			'https://cocochef.ariaamini.com/recipes/1?tab=notes',
		)
	})

	test('redirects a POST with the same status so the method survives', () => {
		const response = legacyHostRedirect(
			request('dutch-oven-production.up.railway.app', '/api/ingest/e', 'POST'),
		)

		expect(response?.status).toBe(307)
	})

	test('leaves the current domain, the new Railway domain and previews alone', () => {
		for (const host of [
			'cocochef.ariaamini.com',
			'cocochef-production.up.railway.app',
			'dutch-oven-staging.up.railway.app',
			'dutch-oven-dutch-oven-pr-88.up.railway.app',
			'localhost:3000',
		]) {
			expect(legacyHostRedirect(request(host))).toBeUndefined()
		}
	})

	test('answers the health check on the old host', () => {
		expect(
			legacyHostRedirect(
				request('dutch-oven-production.up.railway.app', '/api/health'),
			),
		).toBeUndefined()
	})

	test('answers the Google sign-in callback on the old host', () => {
		expect(
			legacyHostRedirect(
				request(
					'dutch-oven-production.up.railway.app',
					'/api/auth/callback/google?code=x&state=y',
				),
			),
		).toBeUndefined()
	})
})
