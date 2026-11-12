import { describe, expect, test } from 'vite-plus/test'
import type { z } from 'zod'

type RecipeJson = z.infer<ReturnType<typeof z.json>>

import { durationMinutes, parseRecipe } from './parse'

const JSON_LD_PAGE = `
<html><head>
<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@type": "Recipe",
	"name": "Balsamic Vinaigrette",
	"image": ["https://example.com/vinaigrette.jpg", "https://example.com/other.jpg"],
	"recipeIngredient": [
		"1/2 cup extra-virgin olive oil",
		"3 tablespoons balsamic vinegar",
		"Kosher salt and freshly ground black pepper, to taste"
	],
	"recipeInstructions": [
		{"@type": "HowToStep", "text": "Whisk the vinegar and oil together."},
		{"@type": "HowToStep", "text": "Season with salt and pepper."}
	]
}
</script>
</head><body></body></html>
`

const GRAPH_PAGE = `
<html><head>
<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@graph": [
		{"@type": "WebSite", "name": "Some Site"},
		{
			"@type": ["Recipe", "Article"],
			"name": "Miso Butter Pasta",
			"image": {"@type": "ImageObject", "url": "https://example.com/pasta.jpg"},
			"recipeIngredient": ["8 ounces spaghetti", "4 tablespoons butter"],
			"recipeInstructions": [
				{
					"@type": "HowToSection",
					"name": "Cook",
					"itemListElement": [
						{"@type": "HowToStep", "text": "Boil the pasta."},
						{"@type": "HowToStep", "text": "Melt butter with miso."}
					]
				},
				{"@type": "HowToStep", "text": "Toss together and serve."}
			]
		}
	]
}
</script>
</head><body></body></html>
`

const TOP_LEVEL_ARRAY_PAGE = `
<html><head>
<script type="application/ld+json">
[
	{"@context": "https://schema.org", "@type": "BreadcrumbList"},
	{"@context": "https://schema.org", "@type": "Recipe", "name": "Dal",
	 "recipeIngredient": ["1 cup red lentils"],
	 "recipeInstructions": "Simmer the lentils.\\nSeason and serve."}
]
</script>
</head><body></body></html>
`

const SINGLE_STEP_OBJECT_PAGE = `
<html><head>
<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@type": "Recipe",
	"name": "One Step Wonder",
	"recipeIngredient": ["1 cup rice"],
	"recipeInstructions": {"@type": "HowToStep", "text": "Cook the rice."}
}
</script>
</head><body></body></html>
`

const MICRODATA_PAGE = `
<html><body>
<div itemscope itemtype="https://schema.org/Recipe">
	<h1 itemprop="name">Weeknight Beans</h1>
	<meta itemprop="image" content="https://example.com/beans.jpg" />
	<ul>
		<li itemprop="recipeIngredient">2 cans white beans</li>
		<li itemprop="recipeIngredient">1 onion, <span>diced</span></li>
	</ul>
	<ol>
		<li itemprop="recipeInstructions">Soften the onion.</li>
		<li itemprop="recipeInstructions">Add beans and simmer.</li>
	</ol>
</div>
</body></html>
`

const OG_ONLY_PAGE = `
<html><head>
<meta property="og:title" content="Mystery Dish" />
<meta property="og:image" content="https://example.com/dish.jpg" />
</head><body></body></html>
`

const JSON_LD_WITH_OG_IMAGE_PAGE = `
<html><head>
<meta property="og:image" content="https://example.com/og-stew.jpg" />
<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@type": "Recipe",
	"name": "Og Image Stew",
	"recipeIngredient": ["1 onion"],
	"recipeInstructions": ["Cook it low and slow."]
}
</script>
</head><body></body></html>
`

function pageWithImage(image: string) {
	return `<script type="application/ld+json">${JSON.stringify({
		'@type': 'Recipe',
		name: 'Image Soup',
		image,
		recipeIngredient: ['1 leek'],
	})}</script>`
}

const WALLED_PAGE = `<html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>`

describe('parseRecipe', () => {
	test('imports recipe-card notes as separate paragraphs and ignores comments', () => {
		const html = `${JSON_LD_PAGE}<div class="wprm-recipe-notes"><span style="display: block;"><strong>1. Oil</strong> &ndash; use olive oil.</span><div class="wprm-spacer"></div><span style="display: block;">Store in the fridge.</span></div><div class="comment-notes">Not a recipe note.</div>`

		expect(parseRecipe(html)?.sourceNotes).toBe(
			'1. Oil – use olive oil.\n\nStore in the fridge.',
		)
		expect(
			parseRecipe(
				`${JSON_LD_PAGE}<div class="comment-notes">Not a recipe note.</div>`,
			)?.sourceNotes,
		).toBeUndefined()
	})
	test('extracts a recipe from a plain JSON-LD block', () => {
		const recipe = parseRecipe(JSON_LD_PAGE)
		expect(recipe).toEqual({
			title: 'Balsamic Vinaigrette',
			imageUrl: 'https://example.com/vinaigrette.jpg',
			ingredients: [
				{ raw: '1/2 cup extra-virgin olive oil' },
				{ raw: '3 tablespoons balsamic vinegar' },
				{ raw: 'Kosher salt and freshly ground black pepper, to taste' },
			],
			steps: [
				'Whisk the vinegar and oil together.',
				'Season with salt and pepper.',
			],
		})
	})

	test('tidies the spaces and brackets stripped tags leave behind', () => {
		const page = JSON_LD_PAGE.replace(
			'"1/2 cup extra-virgin olive oil"',
			'"1 cup broth (<a href=\\"/broth\\">preferably homemade</a> )"',
		).replace(
			'"3 tablespoons balsamic vinegar"',
			'"((5 to 6)) garlic cloves , minced"',
		)

		expect(parseRecipe(page)?.ingredients.slice(0, 2)).toEqual([
			{ raw: '1 cup broth (preferably homemade)' },
			{ raw: '(5 to 6) garlic cloves, minced' },
		])
	})

	test('decodes the fraction and accent entities some sites leave in ingredients', () => {
		const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Crème Brûlée","recipeIngredient":["&frac12; cup cr&egrave;me fra&icirc;che","&frac34; teaspoon salt","1 &amp; &frac14; cups sugar"],"recipeInstructions":"Bake."}</script>`

		expect(parseRecipe(html)?.ingredients.map(({ raw }) => raw)).toEqual([
			'½ cup crème fraîche',
			'¾ teaspoon salt',
			'1 & ¼ cups sugar',
		])
	})

	test('keeps the case of accented capitals in entities', () => {
		const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Pie","recipeIngredient":["&Eacute;clair mix","&Ntilde;oquis flour","&eacute;clair mix"],"recipeInstructions":"Bake."}</script>`

		expect(parseRecipe(html)?.ingredients.map(({ raw }) => raw)).toEqual([
			'Éclair mix',
			'Ñoquis flour',
			'éclair mix',
		])
	})

	test('handles @graph wrappers, array @type, and HowToSection flattening', () => {
		const recipe = parseRecipe(GRAPH_PAGE)
		expect(recipe?.title).toBe('Miso Butter Pasta')
		expect(recipe?.imageUrl).toBe('https://example.com/pasta.jpg')
		expect(recipe?.ingredients).toEqual([
			{ raw: '8 ounces spaghetti' },
			{ raw: '4 tablespoons butter' },
		])
		expect(recipe?.steps).toEqual([
			'Boil the pasta.',
			'Melt butter with miso.',
			'Toss together and serve.',
		])
	})

	test('handles top-level arrays and plain-string instructions', () => {
		const recipe = parseRecipe(TOP_LEVEL_ARRAY_PAGE)
		expect(recipe?.title).toBe('Dal')
		expect(recipe?.steps).toEqual(['Simmer the lentils.', 'Season and serve.'])
	})

	test('handles a standalone HowToStep object as instructions', () => {
		const recipe = parseRecipe(SINGLE_STEP_OBJECT_PAGE)
		expect(recipe?.title).toBe('One Step Wonder')
		expect(recipe?.steps).toEqual(['Cook the rice.'])
	})

	test('falls back to microdata when JSON-LD is absent', () => {
		const recipe = parseRecipe(MICRODATA_PAGE)
		expect(recipe?.title).toBe('Weeknight Beans')
		expect(recipe?.imageUrl).toBe('https://example.com/beans.jpg')
		expect(recipe?.ingredients).toEqual([
			{ raw: '2 cans white beans' },
			{ raw: '1 onion, diced' },
		])
		expect(recipe?.steps).toEqual([
			'Soften the onion.',
			'Add beans and simmer.',
		])
	})

	test('fills a missing JSON-LD image from og:image', () => {
		const recipe = parseRecipe(JSON_LD_WITH_OG_IMAGE_PAGE)
		expect(recipe?.title).toBe('Og Image Stew')
		expect(recipe?.imageUrl).toBe('https://example.com/og-stew.jpg')
	})

	test('fails honestly when only OpenGraph tags exist', () => {
		expect(parseRecipe(OG_ONLY_PAGE)).toBeNull()
	})

	test('fails honestly on decoy pages', () => {
		expect(parseRecipe(WALLED_PAGE)).toBeNull()
	})

	test('resolves a relative image against the page URL', () => {
		const recipe = parseRecipe(
			pageWithImage('/img/soup.jpg'),
			'https://example.com/recipes/soup',
		)

		expect(recipe?.imageUrl).toBe('https://example.com/img/soup.jpg')
	})

	test.each([
		['a data URL', 'data:image/png;base64,AAAA'],
		['a javascript URL', 'javascript:alert(1)'],
		['an over-long URL', `https://example.com/${'a'.repeat(500)}.jpg`],
		['a relative URL without a page URL', '/img/soup.jpg'],
	])('drops %s as the image', (_label, image) => {
		const recipe = parseRecipe(pageWithImage(image))
		expect(recipe?.title).toBe('Image Soup')
		expect(recipe?.imageUrl).toBeUndefined()
	})
})

describe('source ingredient sections', () => {
	const page = (ingredients: RecipeJson, body = '') =>
		'<script type="application/ld+json">' +
		JSON.stringify({
			'@type': 'Recipe',
			name: 'chicken with sauce',
			recipeIngredient: ingredients,
		}) +
		'</script>' +
		body

	test('preserves named ItemLists, nested ListItems, and structured amounts', () => {
		expect(
			parseRecipe(
				page({
					'@type': 'ItemList',
					name: 'Ingredients',
					itemListElement: [
						{
							'@type': 'ItemList',
							name: 'marinade',
							itemListElement: ['1 lemon', '2 tbsp oil'],
						},
						{
							'@type': 'ItemList',
							name: 'sauce',
							itemListElement: [
								{
									'@type': 'ListItem',
									item: {
										'@type': 'PropertyValue',
										name: 'yogurt',
										value: 1,
										unitText: 'cup',
									},
								},
							],
						},
					],
				}),
			)?.ingredients,
		).toEqual([
			{ raw: '## marinade' },
			{ raw: '1 lemon' },
			{ raw: '2 tbsp oil' },
			{ raw: '## sauce' },
			{ raw: '1 cup yogurt' },
		])
	})

	test('recovers WPRM headings only when every ingredient matches in order', () => {
		const html =
			'<div class="wprm-recipe-ingredients-container"><h4 class="wprm-recipe-group-name">marinade</h4><ul><li class="wprm-recipe-ingredient"><span>1 lemon</span></li></ul><h4>for the sauce</h4><ul><li class="wprm-recipe-ingredient">1 cup yogurt</li></ul></div>'

		expect(
			parseRecipe(page(['1 lemon', '1 cup yogurt'], html))?.ingredients,
		).toEqual([
			{ raw: '## marinade' },
			{ raw: '1 lemon' },
			{ raw: '## for the sauce' },
			{ raw: '1 cup yogurt' },
		])

		// An unrelated card, missing ingredient, or reordered list must not group it.
		for (const lines of [
			['1 lemon'],
			['1 cup yogurt', '1 lemon'],
			['1 lemon', 'salt'],
		]) {
			expect(parseRecipe(page(lines, html))?.ingredients).toEqual(
				lines.map((raw) => ({ raw })),
			)
		}
	})

	test('recovers Tasty headings and preserves repeated ingredients in source order', () => {
		const html =
			'<div class="tasty-recipes-ingredients"><h3>dough</h3><ul><li>1 cup flour</li></ul><h3>to dust</h3><ul><li>1 cup flour</li></ul></div>'

		expect(
			parseRecipe(page(['1 cup flour', '1 cup flour'], html))?.ingredients,
		).toEqual([
			{ raw: '## dough' },
			{ raw: '1 cup flour' },
			{ raw: '## to dust' },
			{ raw: '1 cup flour' },
		])
	})

	test('leaves a flat list alone when source sections are absent or already explicit', () => {
		expect(
			parseRecipe(
				page(
					['1 lemon', 'salt'],
					'<h3>recommendations</h3><ul><li>salt</li></ul>',
				),
			)?.ingredients,
		).toEqual([{ raw: '1 lemon' }, { raw: 'salt' }])
		expect(parseRecipe(page(['## sauce', 'salt']))?.ingredients).toEqual([
			{ raw: '## sauce' },
			{ raw: 'salt' },
		])
	})
})

describe('durationMinutes', () => {
	test('reads the ISO 8601 durations recipe pages use', () => {
		expect(durationMinutes('PT45M')).toBe(45)
		expect(durationMinutes('PT1H30M')).toBe(90)
		expect(durationMinutes('P0DT2H')).toBe(120)
		expect(durationMinutes('P1D')).toBe(1440)
	})

	test('knows nothing from zero, nonsense, or nothing', () => {
		expect(durationMinutes('PT0M')).toBeUndefined()
		expect(durationMinutes('45 minutes')).toBeUndefined()
		expect(durationMinutes(undefined)).toBeUndefined()
	})
})

describe('recipe times', () => {
	const timed = (times: Record<string, string>) =>
		parseRecipe(
			`<script type="application/ld+json">${JSON.stringify({
				'@type': 'Recipe',
				name: 'Dal',
				recipeIngredient: ['1 cup red lentils'],
				recipeInstructions: ['Simmer the lentils.'],
				...times,
			})}</script>`,
		)

	test('takes the total time a page gives', () => {
		expect(timed({ totalTime: 'PT40M', prepTime: 'PT5M' })?.totalMinutes).toBe(
			40,
		)
	})

	test('counts the seconds in a time', () => {
		expect(timed({ totalTime: 'PT90S' })?.totalMinutes).toBe(2)
		expect(timed({ totalTime: 'PT1M30S' })?.totalMinutes).toBe(2)
		expect(timed({ totalTime: 'PT20M10S' })?.totalMinutes).toBe(20)
	})

	test('adds prep and cook time when there is no total', () => {
		expect(timed({ prepTime: 'PT10M', cookTime: 'PT25M' })?.totalMinutes).toBe(
			35,
		)
		expect(timed({})?.totalMinutes).toBeUndefined()
	})
})

describe('what readers said', () => {
	const page = (graph: object[]) =>
		parseRecipe(
			`<script type="application/ld+json">${JSON.stringify({
				'@context': 'https://schema.org',
				'@graph': graph,
			})}</script>`,
		)

	const dal = {
		'@type': 'Recipe',
		name: 'Dal',
		recipeIngredient: ['1 cup red lentils'],
		recipeInstructions: ['Simmer the lentils.'],
	}

	test('reads the stars, how many rated, and the comments around it', () => {
		const recipe = page([
			{ '@type': 'Article', commentCount: 337 },
			{
				...dal,
				aggregateRating: {
					'@type': 'AggregateRating',
					ratingValue: '4.94',
					ratingCount: '138',
					reviewCount: '14',
				},
			},
		])

		expect(recipe?.rating).toEqual({ value: 4.94, count: 138 })
		expect(recipe?.commentCount).toBe(337)
	})

	test('finds a rating the page gives in a block of its own', () => {
		const recipe = parseRecipe(
			[
				dal,
				{ aggregateRating: { ratingValue: 4, reviewCount: 8, bestRating: 5 } },
			]
				.map(
					(block) =>
						`<script type="application/ld+json">${JSON.stringify(block)}</script>`,
				)
				.join(''),
		)

		expect(recipe?.rating).toEqual({ value: 4, count: 8 })
	})

	test('never takes the rating or comments of something else on the page', () => {
		const recipe = page([
			{ ...dal, commentCount: 3 },
			{
				'@type': 'Recipe',
				name: 'Related soup',
				aggregateRating: { ratingValue: 5, ratingCount: 900 },
				commentCount: 400,
			},
			{
				'@type': 'Organization',
				aggregateRating: { ratingValue: 4.2, ratingCount: 50 },
				commentCount: 900,
			},
			{ '@type': 'Product', commentCount: 700 },
		])

		expect(recipe?.title).toBe('Dal')
		expect(recipe?.rating).toBeUndefined()
		expect(recipe?.commentCount).toBe(3)
	})

	test('takes a review count when there is no rating count', () => {
		expect(
			page([
				{
					...dal,
					aggregateRating: { ratingValue: 4.6, reviewCount: '1,204' },
				},
			])?.rating,
		).toEqual({ value: 4.6, count: 1204 })
	})

	test('ignores a blank rating, one out of ten, and an impossible count', () => {
		type PageRating = Record<string, string | number>

		const rated = (aggregateRating: PageRating) =>
			page([{ ...dal, aggregateRating }])?.rating

		expect(rated({ ratingValue: '', ratingCount: '12' })).toBeUndefined()
		expect(
			rated({ ratingValue: 4, ratingCount: 12, bestRating: 10 }),
		).toBeUndefined()
		expect(rated({ ratingValue: 4, ratingCount: 12, bestRating: '5' })).toEqual(
			{ value: 4, count: 12 },
		)
		expect(rated({ ratingValue: 4.5, ratingCount: 3e9 })).toBeUndefined()
	})

	test('ignores a rating nobody gave, or one out of range', () => {
		expect(
			page([{ ...dal, aggregateRating: { ratingValue: 5, ratingCount: 0 } }])
				?.rating,
		).toBeUndefined()
		expect(
			page([{ ...dal, aggregateRating: { ratingValue: 9, ratingCount: 3 } }])
				?.rating,
		).toBeUndefined()
		expect(page([dal])?.commentCount).toBeUndefined()
	})
})
