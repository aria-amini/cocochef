import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

import { crawlRecipeSite } from '../src/lib/discover/crawl'
import { spreadEvenly, validLinks } from '../src/lib/discover/recipe-index'
import { recipeSites } from '../src/lib/discover/sites'

const command = process.argv[2]

const limit = Number(process.argv[3] ?? (command === 'index' ? 5000 : 200))

if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20000)
	throw new Error('Limit must be between 1 and 20000.')

// `index [limit] [siteId]` crawls one site and keeps every other site's links.
const onlySite = command === 'index' ? process.argv[4] : undefined

if (onlySite && !recipeSites.some((site) => site.id === onlySite))
	throw new Error(`Unknown site: ${onlySite}`)

const catalogPath = resolve('src/lib/discover/catalog.json')

if (command === 'index') {
	const existing = validLinks(JSON.parse(await readFile(catalogPath, 'utf8')))

	const groups = await Promise.all(
		recipeSites.map(async (site) => {
			if (onlySite && site.id !== onlySite)
				return existing.filter((link) => link.siteId === site.id)

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

	// Only well-formed links reach the committed catalog.
	const written = validLinks(groups.flat())

	// Replaced in one step, so an interrupted run never leaves a truncated catalog
	// for the discovery code that imports it.
	const temp = `${catalogPath}.${process.pid}.tmp`

	await writeFile(temp, `${JSON.stringify(written)}\n`)
	await rename(temp, catalogPath)
	console.log(`${written.length} recipe links written to ${catalogPath}`)
} else if (command === 'seed') {
	// Full recipes are collected only from Good Food, directly, never via the home relay.
	// Reruns reuse the on-disk cache and existing shared source URLs.
	const { BlockedError, CacheError, loadRecipe, pagesDir } =
		await import('./recipe-cache')

	const { createSharedRecipe, findSharedRecipeByUrl } =
		await import('../src/lib/recipes/repository')

	const { canonicalRecipeUrl } = await import('../src/lib/import/url')
	const { getDb } = await import('../src/db/connection')

	const links = validLinks(
		JSON.parse(await readFile(catalogPath, 'utf8')),
	).filter((link) => link.siteId === 'bbcgoodfood')

	const selected = spreadEvenly(links, limit)

	let seeded = 0
	let skipped = 0
	let blocked: string | undefined

	try {
		for (const link of selected) {
			// Only the page fetch can fail as "unavailable". A database or cache
			// failure is not caught as that, so it stops the run with its error and a
			// nonzero exit.
			if (await findSharedRecipeByUrl(canonicalRecipeUrl(link.url))) {
				seeded++
				continue
			}

			let loaded: Awaited<ReturnType<typeof loadRecipe>>

			try {
				loaded = await loadRecipe(link.url, () => pause(300))
			} catch (error) {
				if (error instanceof CacheError) throw error

				if (error instanceof BlockedError) {
					blocked = error.message
					break
				}

				skipped++
				continue
			}

			if (loaded.status === 'gone') {
				skipped++
				continue
			}

			await createSharedRecipe(loaded.recipe)
			seeded++

			if (seeded % 20 === 0) console.log(`${seeded} recipes ready`)
		}

		console.log(
			`${seeded} recipes ready; ${skipped} unavailable. Cache: ${pagesDir}`,
		)

		if (blocked) {
			console.error(`Stopped early: ${blocked}. Wait before running again.`)
			process.exitCode = 1
		}
	} finally {
		await getDb().$client.end()
	}
} else {
	throw new Error(
		'Usage: vpx scripts/recipe-data.ts index [per-site limit] [site id] | seed [recipe count]',
	)
}
