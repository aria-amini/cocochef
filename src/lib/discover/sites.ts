export type RecipeSite = {
	id: string
	name: string
	// Sitemap index (or a single sitemap) the site lists in its robots.txt.
	sitemap: string
	// Child sitemaps worth reading; the rest are tags, authors, and pages.
	children?: RegExp
	// Page URLs that are recipes rather than stories or roundups.
	recipe: RegExp
}

// Sites that publish crawlable sitemaps and recipe JSON-LD the link importer
// reads. Each was checked against its robots.txt. Remove a site here to honor
// an opt-out.
//
// Serious Eats is deliberately absent: its recipe sitemap answers our crawler
// with a Cloudflare pay-per-crawl refusal, and its robots.txt asks for written
// permission before building datasets. Pasted Serious Eats links still import.
// Maangchi and Just One Cookbook are absent too: Maangchi answers crawlers
// with a bot challenge, and Just One Cookbook's Cloudflare refuses the
// server's own requests, so neither its sitemap nor its pages come in.
//
// On the blogs that keep recipes in flat slugs, a slug with the word "recipes"
// is a roundup, not a recipe.
export const recipeSites: RecipeSite[] = [
	{
		id: 'americastestkitchen',
		name: 'America’s Test Kitchen',
		sitemap: 'https://www.americastestkitchen.com/sitemap.xml',
		children: /\/sitemap\/recipes\.xml$/,
		recipe:
			/^https:\/\/www\.americastestkitchen\.com\/recipes\/\d+-[a-z0-9-]+$/,
	},
	{
		id: 'bbcgoodfood',
		name: 'BBC Good Food',
		sitemap: 'https://www.bbcgoodfood.com/sitemap.xml',
		children: /-recipe\.xml$/,
		recipe: /^https:\/\/www\.bbcgoodfood\.com\/recipes\/[a-z0-9-]+$/,
	},
	{
		id: 'bonappetit',
		name: 'Bon Appétit',
		sitemap: 'https://www.bonappetit.com/sitemap.xml',
		recipe: /^https:\/\/www\.bonappetit\.com\/recipe\/[a-z0-9-]+$/,
	},
	{
		id: 'epicurious',
		name: 'Epicurious',
		sitemap: 'https://www.epicurious.com/sitemap.xml',
		recipe:
			/^https:\/\/www\.epicurious\.com\/recipes\/food\/views\/[a-z0-9-]+$/,
	},
	{
		id: 'recipetineats',
		name: 'RecipeTin Eats',
		sitemap: 'https://www.recipetineats.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/www\.recipetineats\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'loveandlemons',
		name: 'Love & Lemons',
		sitemap: 'https://www.loveandlemons.com/sitemap.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/www\.loveandlemons\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'thewoksoflife',
		name: 'The Woks of Life',
		sitemap: 'https://thewoksoflife.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/thewoksoflife\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
	{
		id: 'mykoreankitchen',
		name: 'My Korean Kitchen',
		sitemap: 'https://mykoreankitchen.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/mykoreankitchen\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
	{
		id: 'koreanbapsang',
		name: 'Korean Bapsang',
		sitemap: 'https://www.koreanbapsang.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/www\.koreanbapsang\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
	{
		id: 'hotthaikitchen',
		name: 'Hot Thai Kitchen',
		sitemap: 'https://hot-thai-kitchen.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/hot-thai-kitchen\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
	{
		id: 'rasamalaysia',
		name: 'Rasa Malaysia',
		sitemap: 'https://rasamalaysia.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/rasamalaysia\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
	{
		id: 'budgetbytes',
		name: 'Budget Bytes',
		sitemap: 'https://www.budgetbytes.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe:
			/^https:\/\/www\.budgetbytes\.com\/(?![a-z0-9-]*\brecipes\b)[a-z0-9-]+\/$/,
	},
]

const bareHost = (url: string) => new URL(url).hostname.replace(/^www\./, '')

// Sites are matched by the hostname of their sitemap, not by their id.
const siteHosts = recipeSites.map((site) => ({
	host: bareHost(site.sitemap),
	name: site.name,
}))

export function siteNameFor(url: string | null) {
	if (!url) return undefined

	try {
		const host = bareHost(url)

		return (
			siteHosts.find(
				(site) => host === site.host || host.endsWith(`.${site.host}`),
			)?.name ?? host
		)
	} catch {
		return undefined
	}
}
