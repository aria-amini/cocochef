// Builds tests/support/fixtures/recipe-corpus.json: recipes from many sites,
// kept as title, source URL and ingredient lines only, to exercise the
// ingredient parsing, sprite, category, and icon heuristics offline. It is
// fetched once and committed, so tests never touch the network.
//
// Usage: vpx scripts/recipe-corpus.ts [recipe count] [per-site cap]
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

import { recipeLink } from '../src/lib/discover/recipe-index'
import { decodeEntities } from '../src/lib/import/parse'
import { BlockedError, CacheError, loadRecipe, pagesDir } from './recipe-cache'

const count = Number(process.argv[2] ?? 1000)

const perSiteCap = Number(process.argv[3] ?? 150)

// One request at a time across all sites, so each host sees one request every
// (sites x this) milliseconds. Cached pages cost nothing.
const REQUEST_GAP_MS = 900

// A site that fails this many times in a row is skipped for the run.
const MAX_FAILURES_IN_A_ROW = 5

// So is one whose pages mostly are not recipes (a paywall, say), judged after
// this many tries.
const GIVE_UP_AFTER = 20

const MIN_RECIPE_SHARE = 0.25

if (!Number.isSafeInteger(count) || count < 1 || count > 5000)
	throw new Error('Recipe count must be between 1 and 5000.')

const catalog = recipeLink
	.array()
	.parse(JSON.parse(await readFile('src/lib/discover/catalog.json', 'utf8')))

const fixturePath = resolve('tests/support/fixtures/recipe-corpus.json')

type Corpus = {
	site: string
	title: string
	url: string
	ingredients: string[]
}[]

type Lane = {
	site: string
	candidates: string[]
	next: number
	attempts: number
	kept: number
	failures: number
	done: string | undefined
}

// Candidates are spread evenly across a site's catalog, with room for pages
// that turn out not to be recipes.
const lanes: Lane[] = [...new Set(catalog.map((link) => link.siteId))]
	.sort()
	.map((site) => {
		const links = catalog.filter((link) => link.siteId === site)
		const wanted = perSiteCap * 3
		const step = Math.max(1, Math.floor(links.length / wanted))

		return {
			site,
			candidates: links
				.filter((_, i) => i % step === 0)
				.slice(0, wanted)
				.map((link) => link.url),
			next: 0,
			attempts: 0,
			kept: 0,
			failures: 0,
			done: undefined,
		}
	})

const corpus: Corpus = []

let kept = 0

while (kept < count) {
	const active = lanes.filter((lane) => !lane.done)

	if (!active.length) break

	for (const lane of active) {
		if (kept >= count) break

		const url = lane.candidates[lane.next++]

		if (!url) {
			lane.done = 'ran out of candidates'
			continue
		}

		lane.attempts++

		try {
			const loaded = await loadRecipe(url, () => pause(REQUEST_GAP_MS))

			lane.failures = 0

			if (loaded.status === 'ok') {
				corpus.push({
					site: lane.site,
					title: loaded.recipe.title,
					url: loaded.recipe.sourceUrl,
					// Cached pages predate the importer's entity fix, so decode again.
					ingredients: (loaded.recipe.ingredients ?? []).map(decodeEntities),
				})

				lane.kept++
				kept++

				if (kept % 50 === 0) console.log(`${kept} recipes`)

				if (lane.kept >= perSiteCap) lane.done = 'reached the per-site cap'
			} else if (
				lane.attempts >= GIVE_UP_AFTER &&
				lane.kept / lane.attempts < MIN_RECIPE_SHARE
			) {
				lane.done = 'mostly not recipes'
			}
		} catch (error) {
			// A cache that cannot be written is a problem with this run, not a site.
			if (error instanceof CacheError) throw error

			// Never push on after a site says no; the other sites carry on.
			if (error instanceof BlockedError) {
				lane.done = `blocked (${error.status})`
				console.warn(`${lane.site}: ${error.message}; skipping it`)

				continue
			}

			if (++lane.failures >= MAX_FAILURES_IN_A_ROW)
				lane.done = 'failing repeatedly'
		}
	}
}

corpus.sort(
	(a, b) => a.site.localeCompare(b.site) || a.url.localeCompare(b.url),
)

await writeFile(fixturePath, `${JSON.stringify(corpus, null, '\t')}\n`)

for (const lane of lanes)
	console.log(`${lane.site}: ${lane.kept}${lane.done ? ` (${lane.done})` : ''}`)

console.log(
	`${corpus.length} recipes written to ${fixturePath}. Cache: ${pagesDir}`,
)
