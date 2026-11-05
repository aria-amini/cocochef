import { recipeSites } from '@/lib/discover/sites'

// Sites the link importer is verified against; most recipe sites work. Each id
// matches its logo in public/import-sites and the site's `<id>.com` domain.
export const importSites = [
	{ id: 'nytimes', name: 'NYT Cooking' },
	{ id: 'allrecipes', name: 'Allrecipes' },
	{ id: 'seriouseats', name: 'Serious Eats' },
	{ id: 'bonappetit', name: 'Bon Appétit' },
	{ id: 'bbcgoodfood', name: 'BBC Good Food' },
	{ id: 'simplyrecipes', name: 'Simply Recipes' },
] as const

export const importSiteLogo = (id: string) => `/import-sites/${id}.png`

// Every site with a logo in public/import-sites: the ones imports are verified
// against and the ones recipe discovery reads.
const logoSiteIds = [
	...importSites.map((site) => site.id),
	...recipeSites.map((site) => site.id),
]

// Whether `host` is the site `id`, or one of its subdomains.
const onSite = (host: string, id: string) =>
	host === `${id}.com` || host.endsWith(`.${id}.com`)

// The logo for the site a recipe link points at, if we have one.
export function siteLogoForUrl(url: string | undefined) {
	if (!url) return undefined

	try {
		const host = new URL(url).hostname

		const id = logoSiteIds.find((site) => onSite(host, site))

		return id ? importSiteLogo(id) : undefined
	} catch {
		return undefined
	}
}

export function importSiteForUrl(url: string) {
	try {
		const host = new URL(url).hostname

		return importSites.find((site) => onSite(host, site.id))
	} catch {
		return undefined
	}
}
