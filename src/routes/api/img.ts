import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { getDb } from '@/db/connection'
import { recipes } from '@/db/schema'
import { recipeIndex } from '@/lib/discover/crawl'
import { fetchPublicImage } from '@/lib/import/public-fetch'
import { resizePhoto } from '@/lib/photos/resize.server'
import { photoWidths, type PhotoWidth } from '@/lib/photos/sized'

const isPhotoWidth = (value: number): value is PhotoWidth =>
	photoWidths.some((width) => width === value)

// The photos of the recipe sites' pages the search offers before any is
// brought in, gathered once per crawl of the sites.
let indexed: { links: unknown; photos: ReadonlySet<string> } | undefined

function indexedPhotos() {
	const { links } = recipeIndex()

	if (indexed?.links !== links)
		indexed = {
			links,
			photos: new Set(links.flatMap((link) => link.imageUrl ?? [])),
		}

	return indexed.photos
}

// Whether a recipe, or a recipe page the search offers, shows this photo.
async function isShown(source: string) {
	if (indexedPhotos().has(source)) return true

	const [shown] = await getDb()
		.select({ id: recipes.id })
		.from(recipes)
		.where(eq(recipes.imageUrl, source))
		.limit(1)

	return !!shown
}

// A recipe's photo from its site, made small enough for where it is drawn:
// /api/img?w=400&u=<the photo's address>. Only a photo a recipe or an offered
// recipe page already shows is fetched, so this is no proxy for anything else,
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

				const original = await fetchPublicImage(source).catch(() => null)

				const resized =
					original && (await resizePhoto(original, width).catch(() => null))

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
