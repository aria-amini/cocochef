import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

import { crawlRecipeSite } from '../src/lib/discover/crawl'
import { recipeLink, spreadEvenly } from '../src/lib/discover/recipe-index'
import { recipeSites } from '../src/lib/discover/sites'

const command = process.argv[2]

const limit = Number(process.argv[3] ?? (command === 'index' ? 5000 : 200))

if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20000)
	throw new Error('Limit must be between 1 and 20000.')

const catalogPath = resolve('src/lib/discover/catalog.json')

const cachePath = resolve('.recipe-data/recipes.json')

if (command === 'index') {
	const existing = recipeLink
		.array()
		.parse(JSON.parse(await readFile(catalogPath, 'utf8')))

	const groups = await Promise.all(
		recipeSites.map(async (site) => {
			try {
				const { links, complete } = await crawlRecipeSite(site)

				if (!links.length) throw new Error('No recipe URLs returned')

				// A partial crawl must not replace links it could not re-read, so the
				// site keeps what the catalog holds. With nothing held yet, a partial
				// crawl is better than none.
				if (!complete && existing.some((link) => link.siteId === site.id))
					throw new Error('Incomplete crawl')

				const sampled = spreadEvenly(links, limit)

				console.log(`${site.name}: ${sampled.length} indexed`)

				return sampled
			} catch {
				const kept = existing.filter((link) => link.siteId === site.id)
				console.log(
					`${site.name}: unavailable; keeping ${kept.length} existing links`,
				)

				return kept
			}
		}),
	)

	await writeFile(catalogPath, `${JSON.stringify(groups.flat())}\n`)
	console.log(`${groups.flat().length} recipe links written to ${catalogPath}`)
} else if (command === 'seed') {
	// Full recipes are collected only from Good Food, directly, never via the home relay.
	// Reruns reuse the on-disk cache and existing shared source URLs.
	const { parseRecipe } = await import('../src/lib/import/parse')

	const { clampRecipeTitle, recipeInput } =
		await import('../src/lib/recipes/model')

	const { createSharedRecipe, findSharedRecipeByUrl } =
		await import('../src/lib/recipes/repository')

	const { canonicalRecipeUrl } = await import('../src/lib/import/url')
	const { getDb } = await import('../src/db/connection')

	const entrySchema = recipeInput.extend({
		sourceUrl: recipeInput.shape.sourceUrl.unwrap(),
	})

	let cached: ReturnType<typeof entrySchema.parse>[] = []

	try {
		cached = entrySchema
			.array()
			.parse(JSON.parse(await readFile(cachePath, 'utf8')))
	} catch {
		/* first run */
	}

	const links = recipeLink
		.array()
		.parse(JSON.parse(await readFile(catalogPath, 'utf8')))
		.filter((link) => link.siteId === 'bbcgoodfood')

	const selected = spreadEvenly(links, limit)

	await mkdir(resolve('.recipe-data'), { recursive: true })
	let seeded = 0
	let skipped = 0

	try {
		for (const link of selected) {
			const sourceUrl = canonicalRecipeUrl(link.url)

			try {
				if (await findSharedRecipeByUrl(sourceUrl)) {
					seeded++
					continue
				}

				let input = cached.find((recipe) => recipe.sourceUrl === sourceUrl)

				if (!input) {
					await pause(300)

					const response = await fetch(link.url, {
						headers: { 'user-agent': 'DutchOvenBot/0.1 (recipe discovery)' },
						signal: AbortSignal.timeout(20000),
						redirect: 'error',
					})

					if (!response.ok) throw new Error('Page unavailable')
					const recipe = parseRecipe(await response.text())

					if (!recipe || !recipe.ingredients.length || !recipe.steps.length)
						throw new Error('No complete recipe')
					input = entrySchema.parse({
						title: clampRecipeTitle(recipe.title),
						sourceUrl,
						imageUrl: recipe.imageUrl,
						ingredients: recipe.ingredients.map((line) => line.raw),
						steps: recipe.steps,
					})
					cached.push(input)
					await writeFile(cachePath, `${JSON.stringify(cached)}\n`)
				}

				await createSharedRecipe(input)
				seeded++

				if (seeded % 20 === 0) console.log(`${seeded} recipes ready`)
			} catch {
				skipped++
			}
		}

		console.log(
			`${seeded} recipes ready; ${skipped} unavailable. Cache: ${cachePath}`,
		)
	} finally {
		await getDb().$client.end()
	}
} else {
	throw new Error(
		'Usage: vpx scripts/recipe-data.ts index [per-site limit] | seed [recipe count]',
	)
}
