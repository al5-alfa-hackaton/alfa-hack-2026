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
import { Identity, type IdentityStore } from '../modules/identity/index.js'
import { PostgresIdentityStore } from '../modules/identity/infrastructure/postgres-identity-store.js'
import { passwords } from '../modules/identity/infrastructure/passwords.js'
import { identityDirectory } from './identity-directory.js'
export async function compose(config: Config) {
  const data = await createData(config),
    names = new Map<string, string>(),
    catalog = new ResearchCatalog(
      data,
      config.AGENT_PROVIDER === 'fixture' ? 'fixture' : 'research',
      names,
    )
  const database = config.DATABASE_URL ? createDatabase(config.DATABASE_URL) : undefined
  const identityStore: IdentityStore = database
    ? new PostgresIdentityStore(database.db)
    : {
        byId: async () => undefined,
        byUsername: async () => undefined,
        register: async () => {
          throw new AppError('unavailable', 'Регистрация временно недоступна', true)
        },
        customCompanies: async () => [],
      }
  const identity = new Identity(identityStore, passwords, config.ALLOW_DATASET_LOGIN)
  const hydrate = identityDirectory(identity, data, names)
  const principalFor = async (id: string) => {
    const legacy = config.accounts.find((user) => user.id === id)
    if (legacy)
      return { principal: { id, companyIds: legacy.companyIds }, hash: legacy.token, legacy: true }
    const user = await identity.resolve(id)
    return user
      ? { principal: { id, companyIds: user.companyIds }, hash: user.passwordHash, legacy: false }
      : undefined
  }
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
    reservation:
      config.AGENT_PROVIDER === 'fixture' || config.ALLOW_UNCAPPED_LLM
        ? 0
        : config.RUN_RESERVATION_RUB,
    limit: config.DAILY_BUDGET_RUB,
    mode: config.AGENT_PROVIDER === 'fixture' ? 'fixture' : 'research',
    available: config.AGENT_PROVIDER !== 'disabled',
  })
  const documents = new ResearchDocuments(data, store, config.DATA_DIR)
  const agent =
    config.AGENT_PROVIDER === 'disabled'
      ? {
          execute: async (): Promise<never> => {
            throw new AppError('unavailable', 'Сервис анализа не подключён')
          },
        }
      : config.AGENT_PROVIDER === 'fixture'
        ? new FixtureRuntime(catalog, data)
        : new LangGraphRuntime(
            config,
            catalog,
            data,
            store,
            database ? new CheckpointRuntime(database.pool, config.AGENT_MAX_STEPS + 2) : undefined,
          )
  return {
    database,
    catalog,
    companies,
    analytics,
    documents,
    store,
    agent,
    identity,
    hydrate,
    principalFor,
  }
}
export type Runtime = Awaited<ReturnType<typeof compose>>
