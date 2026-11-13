import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { serverEnv as env } from '@/env.server'

function connect(connectionString: string) {
	return drizzle({ client: new Pool({ connectionString }) })
}

export type Database = ReturnType<typeof connect>

// What a query runs on: the database, or a transaction open on it.
export type Queryable =
	| Database
	| Parameters<Parameters<Database['transaction']>[0]>[0]

let database: Database | undefined

// Connects on first use, so pages without queries need no DATABASE_URL.
export function getDb() {
	if (database) return database

	if (!env.DATABASE_URL) {
		throw new Error(
			'DATABASE_URL is not set. Run `mise run bootstrap` to start the local database.',
		)
	}

	database = connect(env.DATABASE_URL)

	return database
}
