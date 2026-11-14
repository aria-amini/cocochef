import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { getDb } from '@/db/connection'
import { recipes } from '@/db/schema'
import { fetchPublicImage } from '@/lib/import/public-fetch'
import { photoSlot, resizePhoto } from '@/lib/photos/resize.server'
import { photoWidths, type PhotoWidth } from '@/lib/photos/sized'

const isPhotoWidth = (value: number): value is PhotoWidth =>
	photoWidths.some((width) => width === value)

// Whether a recipe shows this photo. Search reads only the database, so its
// rows hold every photo the app draws.
async function isShown(source: string) {
	const [shown] = await getDb()
		.select({ id: recipes.id })
		.from(recipes)
		.where(eq(recipes.imageUrl, source))
		.limit(1)

	return !!shown
}

// A recipe's photo from its site, made small enough for where it is drawn:
// /api/img?w=400&u=<the photo's address>. Only a photo a recipe already shows is fetched, so this is no proxy for anything else,
// and only from a public address (src/lib/import/public-fetch.ts). When the site won't hand it
// over, as some refuse servers, the browser is sent to the original instead.
export const Route = createFileRoute('/api/img')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const query = new URL(request.url).searchParams
				const source = query.get('u') ?? ''
				const width = Number(query.get('w'))

				if (
					!isPhotoWidth(width) ||
					source.length > 2048 ||
					!/^https?:\/\//i.test(source)
				)
					return new Response(null, { status: 400 })

				if (!(await isShown(source))) return new Response(null, { status: 404 })

				const resized = await photoSlot(async () => {
					const original = await fetchPublicImage(source).catch(() => null)

					return original && resizePhoto(original, width).catch(() => null)
				})

				if (!resized)
					return new Response(null, {
						status: 302,
						headers: {
							Location: source,
							'Cache-Control': 'public, max-age=3600',
						},
					})

				return new Response(new Uint8Array(resized), {
					headers: {
						'Content-Type': 'image/webp',
						'Cache-Control': 'public, max-age=31536000, immutable',
						'Content-Length': String(resized.byteLength),
						'X-Content-Type-Options': 'nosniff',
					},
				})
			},
		},
	},
})
