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
		id: 'budgetbytes',
		name: 'Budget Bytes',
		sitemap: 'https://www.budgetbytes.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/www\.budgetbytes\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'cookieandkate',
		name: 'Cookie and Kate',
		sitemap: 'https://cookieandkate.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/cookieandkate\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'minimalistbaker',
		name: 'Minimalist Baker',
		sitemap: 'https://minimalistbaker.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/minimalistbaker\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'pinchofyum',
		name: 'Pinch of Yum',
		sitemap: 'https://pinchofyum.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/pinchofyum\.com\/[a-z0-9-]+$/,
	},
	{
		id: 'sallysbakingaddiction',
		name: 'Sally’s Baking Addiction',
		sitemap: 'https://sallysbakingaddiction.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/sallysbakingaddiction\.com\/[a-z0-9-]+\/$/,
	},
	{
		id: 'skinnytaste',
		name: 'Skinnytaste',
		sitemap: 'https://www.skinnytaste.com/sitemap_index.xml',
		children: /\/post-sitemap\d*\.xml$/,
		recipe: /^https:\/\/www\.skinnytaste\.com\/[a-z0-9-]+\/$/,
	},
]
