import { describe, expect, test } from 'vite-plus/test'

import {
	featuredRecipeLinks,
	parseSitemap,
	searchRecipeLinks,
	titleFromUrl,
	type RecipeLink,
} from './recipe-index'
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

describe('searchRecipeLinks', () => {
	const link = (title: string, siteId = 'a'): RecipeLink => ({
		url: `https://${siteId}.example/${title.replaceAll(' ', '-')}`,
		title,
		siteId,
	})

	const links = [
		link('sheet pan chicken thighs with potatoes'),
		link('crispy chicken thighs'),
		link('chicken thigh adobo'),
		link('lemon chicken soup'),
		link('crispy chicken thighs', 'b'),
	]

	test('needs every word to start a title word', () => {
		expect(
			searchRecipeLinks(links, 'chick thi').map((found) => found.title),
		).toEqual([
			'crispy chicken thighs',
			'chicken thigh adobo',
			'sheet pan chicken thighs with potatoes',
		])
	})

	test('ranks exact words first and drops duplicate titles', () => {
		expect(
			searchRecipeLinks(links, 'thigh').map((found) => found.title),
		).toEqual([
			'chicken thigh adobo',
			'crispy chicken thighs',
			'sheet pan chicken thighs with potatoes',
		])
		expect(
			searchRecipeLinks(links, 'soup chicken').map((found) => found.title),
		).toEqual(['lemon chicken soup'])
	})

	test('returns nothing for a blank query', () => {
		expect(searchRecipeLinks(links, '  ')).toEqual([])
	})
})

describe('featuredRecipeLinks', () => {
	const link = (siteId: string, slug: string, imageUrl?: string) => ({
		url: `https://${siteId}.example/${slug}`,
		title: slug.replaceAll('-', ' '),
		siteId,
		imageUrl,
	})

	const links: RecipeLink[] = [
		...['dal', 'soup', 'stew', 'pie'].map((slug) =>
			link('a', slug, `https://a.example/${slug}.jpg`),
		),
		link('b', 'tacos', 'https://b.example/tacos.jpg'),
		link('b', 'no-picture'),
		link('c', 'dal', 'https://c.example/dal.jpg'),
	]

	test('takes only pictured recipes, with sites taking turns', () => {
		const picked = featuredRecipeLinks(links, 3, 1)

		expect(new Set(picked.map((item) => item.siteId))).toEqual(
			new Set(['a', 'b', 'c']),
		)
		expect(picked.every((item) => item.imageUrl)).toBe(true)
	})

	test('stays the same within a day and skips repeated titles', () => {
		const today = featuredRecipeLinks(links, 10, 20_000)

		expect(featuredRecipeLinks(links, 10, 20_000)).toEqual(today)
		expect(today.map((item) => item.title)).not.toContain('no picture')
		expect(today.filter((item) => item.title === 'dal')).toHaveLength(1)
		expect(today).toHaveLength(5)
	})

	test('changes from one day to the next', () => {
		const days = new Set(
			Array.from(
				{ length: 6 },
				(_, day) => featuredRecipeLinks(links, 1, day)[0]?.url,
			),
		)

		expect(days.size).toBeGreaterThan(1)
	})
})
