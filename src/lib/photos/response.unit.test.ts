import { describe, expect, test } from 'vite-plus/test'

import { photoResponse } from './response'

const photo = (type: string | undefined) =>
	photoResponse({
		body: new Blob(['bytes']).stream(),
		type,
		length: 5,
		etag: '"abc"',
	})

describe('a served photo', () => {
	test('is kept for a year by browsers and Cloudflare', () => {
		const response = photo('image/jpeg')

		expect(response.headers.get('Content-Type')).toBe('image/jpeg')
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=31536000, immutable',
		)
		expect(response.headers.get('ETag')).toBe('"abc"')
		expect(response.headers.get('Content-Length')).toBe('5')
	})

	test.each([
		'text/html',
		'image/svg+xml',
		'application/javascript',
		undefined,
	])('goes out as inert bytes when its upload claimed %s', (type) => {
		const response = photo(type)

		expect(response.headers.get('Content-Type')).toBe(
			'application/octet-stream',
		)
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
		expect(response.headers.get('Content-Security-Policy')).toContain('sandbox')
	})
})
