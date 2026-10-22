import type { Config } from '../config.js'
import { createDatabase } from '../infrastructure/database/client.js'
import { createData } from './data.js'
import { ResearchCatalog } from '../modules/companies/infrastructure/research-catalog.js'
import { Companies } from '../modules/companies/index.js'
import { Analytics } from '../modules/analytics/index.js'
import { PostgresStore } from '../modules/analytics/infrastructure/postgres-store.js'
import { ResearchDocuments } from '../modules/analytics/infrastructure/documents.js'
import {
  FixtureRuntime,
  LangGraphRuntime,
} from '../modules/analytics/infrastructure/agent-runtime.js'
import { CheckpointRuntime } from '../modules/analytics/infrastructure/checkpoint-runtime.js'
import { AppError } from '../shared/kernel/errors.js'
export async function compose(config: Config) {
  const data = await createData(config),
    catalog = new ResearchCatalog(
      data,
      config.AGENT_PROVIDER === 'fixture' ? 'fixture' : 'research',
    )
  const database = config.DATABASE_URL ? createDatabase(config.DATABASE_URL) : undefined
  const unavailable = new Proxy({} as PostgresStore, {
    get() {
      return async () => {
        throw new AppError('unavailable', 'PostgreSQL не настроен', true)
      }
    },
  })
  const store = database ? new PostgresStore(database.db, config.RUN_MAX_RECOVERIES) : unavailable
  const companies = new Companies(catalog)
  const analytics = new Analytics(store, companies, {
    reservation: config.AGENT_PROVIDER === 'fixture' ? 0 : config.RUN_RESERVATION_RUB,
    limit: config.DAILY_BUDGET_RUB,
    mode: config.AGENT_PROVIDER === 'fixture' ? 'fixture' : 'research',
  })
  const documents = new ResearchDocuments(data, store, config.DATA_DIR)
  const agent =
    config.AGENT_PROVIDER === 'fixture'
      ? new FixtureRuntime(catalog, data)
      : new LangGraphRuntime(
          config,
          catalog,
          data,
          store,
          database ? new CheckpointRuntime(database.pool, config.AGENT_MAX_STEPS + 2) : undefined,
        )
  return { database, catalog, companies, analytics, documents, store, agent }
}
export type Runtime = Awaited<ReturnType<typeof compose>>
