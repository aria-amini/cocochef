// Fills an empty development or preview database with the recipe fixture
// (src/db/fixtures). `vp run db:migrate` and the Railway pre-deploy run it
// after migrations. It never touches production or a database that already has
// shared recipes.
import { Pool } from 'pg'

import { loadRecipeFixture } from '../src/db/fixtures/load.ts'

const environment = process.env.APP_ENV

if (environment !== 'development' && environment !== 'preview') {
	console.log(`Recipe fixture skipped (APP_ENV=${environment ?? 'unset'}).`)
} else {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL })

	try {
		const added = await loadRecipeFixture(pool)

		console.log(
			added
				? `Recipe fixture: added ${added} shared recipes.`
				: 'Recipe fixture skipped: the database already has shared recipes.',
		)
	} finally {
		await pool.end()
	}
}
