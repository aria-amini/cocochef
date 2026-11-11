// Reads the ratings of shared recipes brought in before imports kept them:
// each one's page is fetched again, plainly, one at a time with a pause
// between, and its stars, rating count and comment count are stored. A page
// that refuses a plain fetch, or gives no rating, is left as it is.
//
//   vp run recipes:ratings              # up to 200 recipes
//   vp run recipes:ratings -- 50
//   vp run recipes:ratings -- 200 <id>  # carry on after the id the last run printed
//
// Recipes go in id order, so a run picks up where the last one stopped
// rather than re-reading pages that gave no rating.

import { setTimeout as pause } from 'node:timers/promises'

import { and, asc, eq, gt, isNotNull, isNull } from 'drizzle-orm'

import { getDb } from '../src/db/connection'
import { recipes } from '../src/db/schema'
import { parseRecipe } from '../src/lib/import/parse'

// `vp run` passes its own `--` along.
const [count, after] = process.argv.slice(2).filter((arg) => arg !== '--')

const limit = Number(count ?? 200)

if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000)
	throw new Error('Limit must be between 1 and 5000.')

const db = getDb()

const unrated = await db
	.select({ id: recipes.id, sourceUrl: recipes.sourceUrl })
	.from(recipes)
	.where(
		and(
			isNull(recipes.userId),
			isNotNull(recipes.sourceUrl),
			isNull(recipes.ratingCount),
			isNull(recipes.commentCount),
			after ? gt(recipes.id, after) : undefined,
		),
	)
	.orderBy(asc(recipes.id))
	.limit(limit)

let rated = 0

for (const [at, recipe] of unrated.entries()) {
	if (!recipe.sourceUrl) continue

	try {
		const response = await fetch(recipe.sourceUrl, {
			headers: {
				'user-agent':
					'CocochefBot/0.1 (recipe search; +https://cocochef.ariaamini.com)',
			},
			signal: AbortSignal.timeout(20_000),
		})

		if (!response.ok) console.log(`  refused: HTTP ${response.status}`)

		const found = response.ok
			? parseRecipe(await response.text(), recipe.sourceUrl)
			: undefined

		if (found?.rating || found?.commentCount !== undefined) {
			await db
				.update(recipes)
				.set({
					ratingValue: found.rating?.value ?? null,
					ratingCount: found.rating?.count ?? null,
					commentCount: found.commentCount ?? null,
				})
				.where(eq(recipes.id, recipe.id))
			rated++
		}

		console.log(
			`${at + 1}/${unrated.length} ${found?.rating ? `★ ${found.rating.value} (${found.rating.count})` : 'no rating'}  ${recipe.sourceUrl}`,
		)
	} catch (error) {
		console.log(
			`${at + 1}/${unrated.length} skipped (${error instanceof Error ? error.message : String(error)})  ${recipe.sourceUrl}`,
		)
	}

	// One page a second, so no site sees a burst.
	await pause(1000)
}

console.log(`\n${rated} of ${unrated.length} recipes rated`)

const last = unrated.at(-1)

if (unrated.length === limit && last)
	console.log(`more to read: vp run recipes:ratings -- ${limit} ${last.id}`)

process.exit(0)
