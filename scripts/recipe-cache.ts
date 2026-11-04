import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { z } from 'zod'

import { parseRecipe } from '../src/lib/import/parse'
import { canonicalRecipeUrl } from '../src/lib/import/url'
import { isWalled } from '../src/lib/import/wall'
import { clampRecipeTitle, recipeInput } from '../src/lib/recipes/model'

// Every workspace shares one page cache outside the checkout, so a page is
// fetched from this connection once, not once per workspace. Override with
// RECIPE_DATA_DIR.
export const pagesDir = join(
	process.env.RECIPE_DATA_DIR ??
		join(
			process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'),
			'dutch-oven',
			'recipe-data',
		),
	'pages',
)

// A failure to write the page cache is not an unavailable page: callers let it
// stop the run.
export class CacheError extends Error {}

export class BlockedError extends Error {
	constructor(
		readonly host: string,
		readonly status: number,
	) {
		super(`${host} answered ${status}`)
	}
}

export const entrySchema = recipeInput.extend({
	sourceUrl: recipeInput.shape.sourceUrl.unwrap(),
	// Publisher notes, kept the way the link import keeps them.
	sourceNotes: z.string().optional(),
})

export type CachedRecipe = z.infer<typeof entrySchema>

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

// One file per page, renamed into place, so parallel runs never clobber each
// other's entries.
async function writeEntry(url: string, entry: PageEntry) {
	const path = entryPath(url)
	const temp = `${path}.${process.pid}.tmp`

	try {
		await mkdir(pagesDir, { recursive: true })
		await writeFile(temp, JSON.stringify(entry))
		await rename(temp, path)
	} catch (error) {
		throw new CacheError("Couldn't write the page cache", { cause: error })
	}
}

const gone = (reason: string): PageEntry => ({
	status: 'gone',
	reason,
	at: new Date().toISOString(),
})

export type LoadedRecipe =
	| { status: 'ok'; recipe: CachedRecipe }
	| { status: 'gone' }

// Reads a recipe from the cache, or fetches and caches it. Pages that are gone
// or not recipes stay remembered, never refetched. `beforeFetch` runs only
// when the network is about to be used, so callers can throttle without
// slowing cached reads. Throws BlockedError when the site says no (402, 403,
// 429); callers must stop requesting from that host.
export async function loadRecipe(
	url: string,
	beforeFetch?: () => Promise<void>,
): Promise<LoadedRecipe & { cached: boolean }> {
	const sourceUrl = canonicalRecipeUrl(url)
	const entry = await readEntry(sourceUrl)

	if (entry?.status === 'gone') return { status: 'gone', cached: true }

	if (entry) return { status: 'ok', recipe: entry.recipe, cached: true }

	await beforeFetch?.()

	const response = await fetch(url, {
		headers: { 'user-agent': 'CocochefBot/0.1 (recipe discovery)' },
		signal: AbortSignal.timeout(20000),
		redirect: 'manual',
	})

	// Never push on after the site says no.
	if ([402, 403, 429].includes(response.status))
		throw new BlockedError(new URL(url).hostname, response.status)

	// A page that is gone, or has moved for good, is as good as gone for the
	// catalog, and remembered so it is not asked for again. A temporary redirect
	// (302, 303, 307) is retried next run.
	if ([301, 308, 404, 410].includes(response.status)) {
		await writeEntry(sourceUrl, gone(`HTTP ${response.status}`))

		return { status: 'gone', cached: false }
	}

	// Other failures may be temporary, so they are retried next run.
	if (!response.ok) throw new Error('Page unavailable')

	const html = await response.text()
	const recipe = parseRecipe(html, url)

	// A bot wall that answered 200 is not a missing recipe: stop, and leave the
	// page to be asked for again, not remembered as gone.
	if (!recipe && isWalled(response.status, html))
		throw new BlockedError(new URL(url).hostname, response.status)

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
		await writeEntry(sourceUrl, gone('No complete recipe'))

		return { status: 'gone', cached: false }
	}

	await writeEntry(sourceUrl, { status: 'ok', recipe: parsed.data })

	return { status: 'ok', recipe: parsed.data, cached: false }
}
