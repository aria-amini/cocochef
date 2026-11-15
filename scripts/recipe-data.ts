import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

import { z } from 'zod'

import { crawlRecipeSite, spreadEvenly } from '../src/lib/discover/sitemap'
import { recipeSites } from '../src/lib/discover/sites'

// `vp run` passes its own `--` along.
const [command, limitArg, sitesArg] = process.argv
	.slice(2)
	.filter((arg) => arg !== '--')

const limit = Number(limitArg ?? 200)

if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20000)
	throw new Error('Limit must be between 1 and 20000.')

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

if (command === 'seed') {
	// Full recipes are collected directly, never via the home relay: each named
	// site's sitemap is read, and up to the limit of its recipes, spread across
	// the whole of it, come in (Good Food unless sites are named). Reruns reuse
	// the on-disk cache and existing shared source URLs.
	const siteIds = (sitesArg ?? 'bbcgoodfood').split(',')

	for (const id of siteIds)
		if (!recipeSites.some((site) => site.id === id))
			throw new Error(`Unknown site: ${id}`)

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
		// What the page says of time and its readers, as an import keeps it.
		totalMinutes: z.number().int().positive().optional(),
		rating: z.object({ value: z.number(), count: z.number() }).optional(),
		commentCount: z.number().int().nonnegative().optional(),
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

	// A site whose sitemap can't be read is skipped; one that says no to a page
	// stops only its own turn.
	const selected = (
		await Promise.all(
			recipeSites
				.filter((site) => siteIds.includes(site.id))
				.map(async (site) => {
					try {
						const links = await crawlRecipeSite(site)
						console.log(`${site.name}: ${links.length} recipes in its sitemap`)

						return spreadEvenly(links, limit)
					} catch (error) {
						console.error(`${site.name}: sitemap unavailable: ${String(error)}`)

						return []
					}
				}),
		)
	).flat()

	await mkdir(pagesDir, { recursive: true })
	let seeded = 0
	let skipped = 0
	const blocked = new Map<string, string>()

	try {
		for (const link of selected) {
			if (blocked.has(link.siteId)) continue

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
						headers: { 'user-agent': 'CocochefBot/0.1 (recipe discovery)' },
						signal: AbortSignal.timeout(20000),
						redirect: 'manual',
					})

					// Never push on after the site says no.
					if ([402, 403, 429].includes(response.status))
						throw new BlockedError(
							`${new URL(link.url).hostname} answered ${response.status}`,
						)

					// A page that is gone, or has moved for good, is as good as gone for
					// the catalog, and remembered so it is not asked for again. A
					// temporary redirect (302, 303, 307) is retried next run.
					if ([301, 308, 404, 410].includes(response.status)) {
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
							totalMinutes: recipe.totalMinutes,
							rating: recipe.rating,
							commentCount: recipe.commentCount,
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
					blocked.set(link.siteId, error.message)
					continue
				}

				skipped++
			}
		}

		console.log(
			`${seeded} recipes ready; ${skipped} unavailable. Cache: ${pagesDir}`,
		)

		for (const reason of blocked.values()) {
			console.error(`Stopped early: ${reason}. Wait before running again.`)
			process.exitCode = 1
		}
	} finally {
		await getDb().$client.end()
	}
} else {
	throw new Error(
		'Usage: vpx scripts/recipe-data.ts seed [recipes per site] [site,site…]',
	)
}
