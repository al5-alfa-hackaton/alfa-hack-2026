import cors from '@fastify/cors'
import { sql } from 'drizzle-orm'
import Fastify from 'fastify'
import { loadConfig, type Config } from './config.js'
import { createDatabase } from './db/client.js'

export function buildApp(config: Config = loadConfig()) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } })
  const database = config.DATABASE_URL ? createDatabase(config.DATABASE_URL) : undefined

  app.register(cors, { origin: config.CORS_ORIGIN })
  app.get('/health', async () => ({ status: 'ok', service: 'backend' }))
  app.get('/ready', async (_request, reply) => {
    if (!database) return { status: 'ok', database: 'not_configured' }
    try {
      await database.db.execute(sql`select 1`)
      return { status: 'ok', database: 'ok' }
    } catch {
      return reply.code(503).send({ status: 'unavailable', database: 'unavailable' })
    }
  })
  app.addHook('onClose', async () => { await database?.pool.end() })
  return app
}
