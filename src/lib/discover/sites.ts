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
export const recipeSites: RecipeSite[] = [
	{
		id: 'seriouseats',
		name: 'Serious Eats',
		sitemap: 'https://www.seriouseats.com/sitemap.xml',
		recipe: /^https:\/\/www\.seriouseats\.com\/[a-z0-9-]*recipe[a-z0-9-]*$/,
	},
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
]
