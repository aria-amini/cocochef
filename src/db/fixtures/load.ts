// Fifty shared recipes for a database that has none: a new worktree, or a
// Railway PR preview. Search reads only the database, so without them home and
// search show nothing there.
//
// Each is a real recipe from the catalog, stored the way the seed stores one
// (src/lib/recipes/repository.ts, createSharedRecipe): no owner, its page as
// `source_url`, its ingredient lines, its rating, and its Jev meal tags, so
// search, the bubbles and the recipe page behave as they do in production. The
// methods are short summaries written for this file, not the sites' text; the
// recipe links to the full original.
//
// This runs as plain Node after `pnpm prune` in the Railway deploy, so it
// imports only Node builtins and `pg`, never app code.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { Pool, PoolClient } from 'pg'

export type FixtureRecipe = {
	id: string
	title: string
	sourceUrl: string
	imageUrl: string
	totalMinutes?: number
	prepMinutes?: number
	servings?: number
	commentCount?: number
	rating: { value: number; count: number }
	ingredients: string[]
	steps: string[]
	tags: {
		meal: boolean
		cuisines: string[]
		flavors: string[]
		proteins: string[]
		forms: string[]
		model: string
	}
}

export async function readRecipeFixture(): Promise<FixtureRecipe[]> {
	const file = resolve(import.meta.dirname, 'recipes.json')

	// The server test checks the file's shape against what the app reads.
	const fixture: FixtureRecipe[] = JSON.parse(await readFile(file, 'utf8'))

	return fixture
}

async function insertRecipe(client: PoolClient, recipe: FixtureRecipe) {
	const now = new Date()

	await client.query(
		`insert into recipes (id, user_id, title, image_url, source_url,
			total_minutes, prep_minutes, servings, rating_value, rating_count,
			comment_count, created_at, finalized_at)
		values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
		on conflict do nothing`,
		[
			recipe.id,
			recipe.title,
			recipe.imageUrl,
			recipe.sourceUrl,
			recipe.totalMinutes ?? null,
			recipe.prepMinutes ?? null,
			recipe.servings ?? null,
			recipe.rating.value,
			recipe.rating.count,
			recipe.commentCount ?? null,
			now,
		],
	)

	for (const [position, text] of recipe.ingredients.entries()) {
		await client.query(
			`insert into recipe_ingredients (id, recipe_id, position, text)
			values ($1, $2, $3, $4) on conflict do nothing`,
			[`${recipe.id}-i${position}`, recipe.id, position, text],
		)
	}

	for (const [position, text] of recipe.steps.entries()) {
		await client.query(
			`insert into recipe_steps (id, recipe_id, position, text)
			values ($1, $2, $3, $4) on conflict do nothing`,
			[`${recipe.id}-s${position}`, recipe.id, position, text],
		)
	}

	const { tags } = recipe

	await client.query(
		`insert into meal_tags (key, meal, cuisines, flavors, proteins, forms,
			model, tagged_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8)
		on conflict do nothing`,
		[
			recipe.sourceUrl,
			tags.meal,
			tags.cuisines,
			tags.flavors,
			tags.proteins,
			tags.forms,
			tags.model,
			now,
		],
	)
}

// Adds the fixture unless the database already holds shared recipes, all in
// one transaction. Fixed IDs keep a rerun from adding anything twice. Returns
// how many recipes it added.
export async function loadRecipeFixture(pool: Pool) {
	const client = await pool.connect()

	try {
		const { rows } = await client.query<{ any: boolean }>(
			'select exists (select 1 from recipes where user_id is null) as any',
		)

		if (rows[0]?.any) return 0

		const fixture = await readRecipeFixture()

		await client.query('begin')

		try {
			for (const recipe of fixture) await insertRecipe(client, recipe)
			await client.query('commit')
		} catch (error) {
			await client.query('rollback')
			throw error
		}

		return fixture.length
	} finally {
		client.release()
	}
}
