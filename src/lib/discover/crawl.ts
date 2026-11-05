import catalog from './catalog.json'
import {
	mergeLinks,
	parseSitemap,
	titleFromUrl,
	validLinks,
	type RecipeLink,
} from './recipe-index'
import { recipeSites, type RecipeSite } from './sites'

// Prototype index: crawled into process memory on first search and refreshed
// daily. Assumes one instance (railway.toml runs numReplicas = 1).
const REFRESH_MS = 24 * 60 * 60 * 1000

const MAX_SITEMAPS_PER_SITE = 100

const CRAWLER_HEADERS = {
	'user-agent':
		'CocochefBot/0.1 (recipe search; +https://cocochef.ariaamini.com)',
	accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5',
}

const initial = validLinks(catalog)

const bySite = new Map<string, RecipeLink[]>(
	recipeSites.map((site) => [
		site.id,
		initial.filter((link) => link.siteId === site.id),
	]),
)

let flat: RecipeLink[] = initial

let crawling: Promise<void> | undefined

let crawledAt = 0

async function fetchSitemap(url: string, site: RecipeSite) {
	if (new URL(url).hostname !== new URL(site.sitemap).hostname) return

	const response = await fetch(url, {
		headers: CRAWLER_HEADERS,
		redirect: 'error',
		signal: AbortSignal.timeout(20_000),
	})

	if (!response.ok) throw new Error(`${response.status} for ${url}`)

	return parseSitemap(await response.text())
}

// `complete` is false when a child sitemap failed or was past the cap, so what
// came back is only part of the site and must not replace links already held
// for it.
export async function crawlRecipeSite(site: RecipeSite) {
	const root = await fetchSitemap(site.sitemap, site)

	if (!root) return { links: [], complete: true }

	const matching = root.sitemaps.filter(
		(url) => !site.children || site.children.test(url),
	)

	const children = matching.slice(0, MAX_SITEMAPS_PER_SITE)
	const pages = [...root.pages]
	let complete = matching.length <= MAX_SITEMAPS_PER_SITE

	for (const child of children) {
		try {
			pages.push(...((await fetchSitemap(child, site))?.pages ?? []))
		} catch (error) {
			complete = false
			console.warn(`[discover] skipped ${child}`, error)
		}
	}

	const seen = new Set<string>()

	const links = pages.flatMap((page) => {
		if (!site.recipe.test(page.url) || seen.has(page.url)) return []
		seen.add(page.url)
		const title = titleFromUrl(page.url)

		return title
			? [{ url: page.url, title, siteId: site.id, imageUrl: page.imageUrl }]
			: []
	})

	return { links, complete }
}

function crawl() {
	crawling = Promise.all(
		recipeSites.map(async (site) => {
			try {
				const { links, complete } = await crawlRecipeSite(site)

				// A partial crawl adds what it found but never drops the links it could
				// not re-read.
				const next = complete
					? links
					: mergeLinks(bySite.get(site.id) ?? [], links)

				if (next.length) bySite.set(site.id, next)
				flat = [...bySite.values()].flat()
			} catch (error) {
				console.warn(`[discover] couldn't crawl ${site.name}`, error)
			}
		}),
	).then(() => {
		crawledAt = Date.now()
		crawling = undefined
	})
}

export function recipeIndex() {
	if (!crawling && Date.now() - crawledAt > REFRESH_MS) crawl()

	// Warming until the first crawl lands, even while the bundled catalog is
	// already answering: the client keeps asking, so fresh links replace it.
	return { links: flat, warming: crawledAt === 0 }
}
