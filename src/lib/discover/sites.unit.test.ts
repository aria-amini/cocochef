import { describe, expect, it } from 'vite-plus/test'

import catalog from './catalog.json'
import { recipeSites } from './sites'

describe('recipeSites', () => {
	it.each(recipeSites)(
		'$name recipe pattern is on its sitemap host',
		({ sitemap, recipe }) => {
			// The crawler skips child sitemaps on another host, so a www mismatch
			// between the two silently yields no links.
			const host = new URL(sitemap).hostname.replaceAll('.', '\\.')

			expect(recipe.source).toContain(host)
		},
	)

	it.each(recipeSites)('$name has links in the catalog', ({ id }) => {
		expect(catalog.some((link) => link.siteId === id)).toBe(true)
	})

	it('lists each site once', () => {
		const ids = recipeSites.map((site) => site.id)

		expect(new Set(ids).size).toBe(ids.length)
	})
})
