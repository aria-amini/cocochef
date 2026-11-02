import { describe, expect, test } from 'vite-plus/test'
import type { z } from 'zod'

type RecipeJson = z.infer<ReturnType<typeof z.json>>

import { parseRecipe } from './parse'

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
