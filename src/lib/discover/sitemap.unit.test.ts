import { describe, expect, test } from 'vite-plus/test'

import { parseSitemap, spreadEvenly, titleFromUrl } from './sitemap'
import { recipeSites } from './sites'

describe('parseSitemap', () => {
	test('lists child sitemaps from an index', () => {
		expect(
			parseSitemap(`<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap>
	<sitemap><loc><![CDATA[https://example.com/post-sitemap2.xml]]></loc></sitemap>
</sitemapindex>`),
		).toEqual({
			sitemaps: [
				'https://example.com/post-sitemap.xml',
				'https://example.com/post-sitemap2.xml',
			],
			pages: [],
		})
	})

	test('reads page urls with their first image', () => {
		expect(
			parseSitemap(`<urlset>
	<url>
		<loc>https://example.com/dal/?a=1&amp;b=2</loc>
		<image:image><image:loc>https://example.com/dal.jpg</image:loc></image:image>
		<image:image><image:loc>https://example.com/dal-2.jpg</image:loc></image:image>
	</url>
	<url><loc>https://example.com/soup/</loc></url>
</urlset>`).pages,
		).toEqual([
			{
				url: 'https://example.com/dal/?a=1&b=2',
				imageUrl: 'https://example.com/dal.jpg',
			},
			{ url: 'https://example.com/soup/', imageUrl: undefined },
		])
	})
})

test.each([
	[
		'https://www.bbcgoodfood.com/recipes/roast-chicken-soup',
		'roast chicken soup',
	],
	[
		'https://www.budgetbytes.com/kale-and-white-bean-power-bowls/',
		'kale and white bean power bowls',
	],
	['https://cookieandkate.com/best-lentil-soup-recipe/', 'best lentil soup'],
	[
		'https://www.epicurious.com/recipes/food/views/ba-syn-cottage-cheese-meatballs',
		'cottage cheese meatballs',
	],
	[
		'https://www.bonappetit.com/recipe/epi-syn-coconut-lentil-soup',
		'coconut lentil soup',
	],
	[
		'https://www.epicurious.com/recipes/food/views/chicken-stew-51234',
		'chicken stew',
	],
	[
		'https://www.americastestkitchen.com/recipes/8890-jamaican-oxtail',
		'jamaican oxtail',
	],
	[
		'https://www.americastestkitchen.com/recipes/54-glazed-lemon-cookies',
		'glazed lemon cookies',
	],
	['https://www.bbcgoodfood.com/recipes/15-minute-pasta', '15 minute pasta'],
	[
		'https://www.bonappetit.com/recipe/5-ingredient-chicken',
		'5 ingredient chicken',
	],
])('titles %s as %s', (url, title) => {
	expect(titleFromUrl(url)).toBe(title)
})

test.each([
	['bbcgoodfood', 'https://www.bbcgoodfood.com/recipes/quick-kimchi', true],
	['bbcgoodfood', 'https://www.bbcgoodfood.com/howto/guide/kimchi', false],
	['bonappetit', 'https://www.bonappetit.com/recipe/soboro-don', true],
	['bonappetit', 'https://www.bonappetit.com/story/editors-picks', false],
	['recipetineats', 'https://www.recipetineats.com/chicken-chasseur/', true],
	['recipetineats', 'https://www.recipetineats.com/category/dinner/', false],
])('%s treats %s as a recipe: %s', (id, url, expected) => {
	expect(recipeSites.find((site) => site.id === id)?.recipe.test(url)).toBe(
		expected,
	)
})

describe('spreadEvenly', () => {
	test('keeps a list that already fits', () => {
		const items = [1, 2, 3]

		expect(spreadEvenly(items, 3)).toBe(items)
		expect(spreadEvenly(items, 10)).toBe(items)
	})

	test('samples a long list from end to end, not its first entries', () => {
		const items = Array.from({ length: 7000 }, (_, i) => i)
		const picked = spreadEvenly(items, 5000)

		expect(picked).toHaveLength(5000)
		expect(picked[0]).toBe(0)
		// The old stride of 1 stopped at index 4999.
		expect(picked.at(-1)).toBeGreaterThan(6900)
		expect(new Set(picked).size).toBe(5000)
	})
})
