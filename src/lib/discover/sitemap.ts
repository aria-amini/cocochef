import type { RecipeSite } from './sites'

// Reads the recipe sites' sitemaps for the seed script (scripts/recipe-data.ts),
// which brings recipes into cocochef. The app itself searches only what is in
// the database.

// A recipe page a sitemap lists, named by its slug.
export type RecipeLink = {
	url: string
	title: string
	siteId: string
	imageUrl?: string | undefined
}

export type ParsedSitemap = {
	sitemaps: string[]
	pages: { url: string; imageUrl?: string | undefined }[]
}

const LOC = /<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/

function decodeXml(text: string) {
	return text
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&')
}

export function parseSitemap(xml: string): ParsedSitemap {
	if (/<sitemapindex[\s>]/.test(xml)) {
		const sitemaps = [
			...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g),
		].flatMap(([, block = '']) => {
			const loc = LOC.exec(block)?.[1]

			return loc ? [decodeXml(loc)] : []
		})

		return { sitemaps, pages: [] }
	}

	const pages = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(
		([, block = '']) => {
			const loc = LOC.exec(block)?.[1]

			if (!loc) return []
			const image = /<image:loc>\s*([^<]+?)\s*<\/image:loc>/.exec(block)?.[1]

			return [
				{
					url: decodeXml(loc),
					imageUrl: image ? decodeXml(image) : undefined,
				},
			]
		},
	)

	return { sitemaps: [], pages }
}

// At most `limit` picks, evenly spaced across the whole list, rather than its
// first `limit` entries, so a big sitemap is sampled end to end.
export function spreadEvenly<T>(items: T[], limit: number) {
	if (items.length <= limit) return items

	const picks = new Set(
		Array.from({ length: limit }, (_, i) =>
			Math.floor((i * items.length) / limit),
		),
	)

	return items.filter((_, i) => picks.has(i))
}

// Recipe slugs read as titles: /recipes/crispy-chicken-thighs -> "crispy chicken thighs".
export function titleFromUrl(url: string) {
	const { hostname, pathname } = new URL(url)
	const slug = pathname.split('/').filter(Boolean).at(-1) ?? ''

	// America's Test Kitchen leads its slugs with a numeric id; elsewhere a
	// leading number belongs to the name, like 15-minute-pasta.
	const id = hostname.endsWith('americastestkitchen.com') ? /^\d+-/ : /^$/

	return decodeURIComponent(slug)
		.toLowerCase()
		.replace(/^(ba|epi)-syn-/, '')
		.replace(/-\d+$/, '')
		.replace(id, '')
		.replace(/(^|-)recipes?$/, '')
		.replaceAll('-', ' ')
		.trim()
}

const MAX_SITEMAPS_PER_SITE = 100

const CRAWLER_HEADERS = {
	'user-agent':
		'CocochefBot/0.1 (recipe search; +https://cocochef.ariaamini.com)',
	accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5',
}

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

// The site's recipe pages, from its sitemap and up to MAX_SITEMAPS_PER_SITE of
// its child sitemaps. A child that fails is skipped.
export async function crawlRecipeSite(site: RecipeSite) {
	const root = await fetchSitemap(site.sitemap, site)

	if (!root) return []

	const children = root.sitemaps
		.filter((url) => !site.children || site.children.test(url))
		.slice(0, MAX_SITEMAPS_PER_SITE)

	const pages = [...root.pages]

	for (const child of children) {
		try {
			pages.push(...((await fetchSitemap(child, site))?.pages ?? []))
		} catch (error) {
			// A site that blocks datacenter crawlers (402, 403, 429) is expected;
			// the message is enough without a stack trace.
			console.warn(`[discover] skipped ${child}: ${String(error)}`)
		}
	}

	const seen = new Set<string>()

	return pages.flatMap((page) => {
		if (!site.recipe.test(page.url) || seen.has(page.url)) return []
		seen.add(page.url)
		const title = titleFromUrl(page.url)

		return title
			? [{ url: page.url, title, siteId: site.id, imageUrl: page.imageUrl }]
			: []
	})
}
