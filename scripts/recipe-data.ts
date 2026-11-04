import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

import { z } from 'zod'

import { crawlRecipeSite } from '../src/lib/discover/crawl'
import { recipeLink, spreadEvenly } from '../src/lib/discover/recipe-index'
import { recipeSites } from '../src/lib/discover/sites'

const command = process.argv[2]

const limit = Number(process.argv[3] ?? (command === 'index' ? 5000 : 200))

if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20000)
	throw new Error('Limit must be between 1 and 20000.')

const catalogPath = resolve('src/lib/discover/catalog.json')

// Every workspace shares one page cache outside the checkout, so a page is
// fetched from this connection once, not once per workspace. Override with
// RECIPE_DATA_DIR.
const pagesDir = join(
	process.env.RECIPE_DATA_DIR ??
		join(
			process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'),
			'dutch-oven',
			'recipe-data',
		),
	'pages',
)

class BlockedError extends Error {}

// A database failure is not an unavailable page: it stops the run, loudly.
class PersistenceError extends Error {}

async function persisted<T>(work: Promise<T>) {
	try {
		return await work
	} catch (error) {
		throw new PersistenceError("Couldn't save to the cache or database", {
			cause: error,
		})
	}
}

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

	const { isWalled } = await import('../src/lib/import/wall')
	const { canonicalRecipeUrl } = await import('../src/lib/import/url')
	const { getDb } = await import('../src/db/connection')

	const entrySchema = recipeInput.extend({
		sourceUrl: recipeInput.shape.sourceUrl.unwrap(),
		// Publisher notes, kept the way the link import keeps them.
		sourceNotes: z.string().optional(),
	})

	const pageEntry = z.union([
		z.object({ status: z.literal('ok'), recipe: entrySchema }),
		z.object({ status: z.literal('gone'), reason: z.string(), at: z.string() }),
	])

	type PageEntry = z.infer<typeof pageEntry>

	const entryPath = (url: string) =>
		join(pagesDir, `${createHash('sha256').update(url).digest('hex')}.json`)

	async function readEntry(url: string) {
		try {
			return pageEntry.parse(JSON.parse(await readFile(entryPath(url), 'utf8')))
		} catch {
			return undefined
		}
	}

	// One file per page, renamed into place, so parallel runs never clobber
	// each other's entries.
	async function writeEntry(url: string, entry: PageEntry) {
		const path = entryPath(url)
		const temp = `${path}.${process.pid}.tmp`

		await writeFile(temp, JSON.stringify(entry))
		await rename(temp, path)
	}

	const gone = (reason: string): PageEntry => ({
		status: 'gone',
		reason,
		at: new Date().toISOString(),
	})

	const links = recipeLink
		.array()
		.parse(JSON.parse(await readFile(catalogPath, 'utf8')))
		.filter((link) => link.siteId === 'bbcgoodfood')

	const selected = spreadEvenly(links, limit)

	await mkdir(pagesDir, { recursive: true })
	let seeded = 0
	let skipped = 0
	let blocked: string | undefined

	try {
		for (const link of selected) {
			const sourceUrl = canonicalRecipeUrl(link.url)

			try {
				if (await persisted(findSharedRecipeByUrl(sourceUrl))) {
					seeded++
					continue
				}

				const entry = await readEntry(sourceUrl)

				// Pages that are gone or not recipes stay remembered, never refetched.
				if (entry?.status === 'gone') {
					skipped++
					continue
				}

				let input = entry?.recipe

				if (!input) {
					await pause(300)

					const response = await fetch(link.url, {
						headers: { 'user-agent': 'DutchOvenBot/0.1 (recipe discovery)' },
						signal: AbortSignal.timeout(20000),
						redirect: 'error',
					})

					// Never push on after the site says no.
					if ([402, 403, 429].includes(response.status))
						throw new BlockedError(
							`${new URL(link.url).hostname} answered ${response.status}`,
						)

					if (response.status === 404 || response.status === 410) {
						await persisted(
							writeEntry(sourceUrl, gone(`HTTP ${response.status}`)),
						)
						skipped++
						continue
					}

					// Other failures may be temporary, so they are retried next run.
					if (!response.ok) throw new Error('Page unavailable')
					const html = await response.text()
					const recipe = parseRecipe(html, link.url)

					// A bot wall that answered 200 is not a missing recipe: stop, and
					// leave the page to be asked for again, not remembered as gone.
					if (!recipe && isWalled(response.status, html))
						throw new BlockedError(
							`${new URL(link.url).hostname} served a bot challenge`,
						)

					const parsed = entrySchema.safeParse(
						recipe && {
							title: clampRecipeTitle(recipe.title),
							sourceUrl,
							imageUrl: recipe.imageUrl,
							ingredients: recipe.ingredients.map((line) => line.raw),
							steps: recipe.steps,
							sourceNotes: recipe.sourceNotes,
						},
					)

					if (
						!parsed.success ||
						!parsed.data.ingredients?.length ||
						!parsed.data.steps?.length
					) {
						await persisted(writeEntry(sourceUrl, gone('No complete recipe')))
						skipped++
						continue
					}

					input = parsed.data
					await persisted(
						writeEntry(sourceUrl, { status: 'ok', recipe: input }),
					)
				}

				await persisted(createSharedRecipe(input))
				seeded++

				if (seeded % 20 === 0) console.log(`${seeded} recipes ready`)
			} catch (error) {
				if (error instanceof PersistenceError) throw error

				if (error instanceof BlockedError) {
					blocked = error.message
					break
				}

				skipped++
			}
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
		'Usage: vpx scripts/recipe-data.ts index [per-site limit] | seed [recipe count]',
	)
}
