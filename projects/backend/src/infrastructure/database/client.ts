import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    query_timeout: 10000,
  })
  pool.on('error', (error) => process.stderr.write(`Database pool error: ${error.name}\n`))
  return { db: drizzle({ client: pool, schema }), pool }
}
export type Database = ReturnType<typeof createDatabase>['db']
