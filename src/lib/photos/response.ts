// The browser picks a photo's type at upload and nothing checks it, so only a
// raster image type is served as itself. Anything else, such as HTML or SVG,
// goes out as bytes that cannot run on this site.
const photoTypes = new Set([
	'image/avif',
	'image/gif',
	'image/heic',
	'image/heif',
	'image/jpeg',
	'image/png',
	'image/webp',
])

// An uploaded photo, kept for a year by browsers and Cloudflare. Each upload
// gets a new key and a photo is never written twice, so its address always
// means the same bytes.
export function photoResponse(photo: {
	body: ReadableStream
	type: string | undefined
	length: number | undefined
	etag: string | undefined
}) {
	return new Response(photo.body, {
		headers: {
			'Content-Type':
				photo.type && photoTypes.has(photo.type)
					? photo.type
					: 'application/octet-stream',
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'; sandbox",
			...(photo.length !== undefined && {
				'Content-Length': String(photo.length),
			}),
			...(photo.etag && { ETag: photo.etag }),
		},
	})
}

export const missingPhoto = () =>
	new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
