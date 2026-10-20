import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, query_timeout: 3000 })
  const db = drizzle({ client: pool, schema })
  return { db, pool }
}
