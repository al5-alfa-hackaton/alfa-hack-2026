import { createDatabase } from '../src/infrastructure/database/client.js'
import { setupCheckpoints } from '../src/modules/analytics/infrastructure/checkpoint-runtime.js'
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const database = createDatabase(process.env.DATABASE_URL)
try {
  await setupCheckpoints(database.pool)
  process.stdout.write('LangGraph checkpoint migrations applied\n')
} finally {
  await database.pool.end()
}
