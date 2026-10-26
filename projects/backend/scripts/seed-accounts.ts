import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { loadConfig } from '../src/config.js'
import { createDatabase } from '../src/infrastructure/database/client.js'
import { createData } from '../src/composition/data.js'
import {
  seedDatasetAccounts,
  type DatasetAccount,
} from '../src/modules/identity/infrastructure/seed-dataset.js'

const { values } = parseArgs({
  options: {
    fixtures: { type: 'boolean', default: false },
  },
})
const root = fileURLToPath(new URL('../../../', import.meta.url))
if (!process.env.AUTH_SESSION_SECRET) {
  const secret = randomBytes(36).toString('base64url')
  const path = resolve(root, 'projects/backend/.env')
  const text = existsSync(path) ? await readFile(path, 'utf8') : ''
  const next = /^AUTH_SESSION_SECRET=/m.test(text)
    ? text.replace(/^AUTH_SESSION_SECRET=.*$/m, 'AUTH_SESSION_SECRET=' + secret)
    : text.trimEnd() + '\nAUTH_SESSION_SECRET=' + secret + '\n'
  await writeFile(path, next, { mode: 0o600 })
  process.env.AUTH_SESSION_SECRET = secret
}
if (process.env.AGENT_PROVIDER === 'fixture' && !values.fixtures)
  throw new Error('Use --fixtures for isolated test data')
const config = loadConfig({
  ...process.env,
  AGENT_PROVIDER: values.fixtures ? 'fixture' : 'disabled',
  ALLOW_UNCAPPED_LLM: 'false',
})
if (!config.DATABASE_URL) throw new Error('Set DATABASE_URL before seeding accounts')
const data = await createData(config)
const ids = [...data.companies.companies]
  .filter(([, rows]) => rows.some((row) => row.clientType === 'CLIENT'))
  .map(([id]) => id)
  .sort()
const accounts: DatasetAccount[] = ids.map((companyId) => ({
  companyId,
  username: 'client_' + companyId.toLowerCase(),
}))
const database = createDatabase(config.DATABASE_URL)
try {
  await seedDatasetAccounts(database.db, accounts)
  process.stdout.write('Seeded ' + accounts.length + ' selectable company accounts.\n')
} finally {
  await database.pool.end()
}
