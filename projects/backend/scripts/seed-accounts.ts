import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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
    credentials: { type: 'string' },
  },
})
const root = fileURLToPath(new URL('../../../', import.meta.url))
const target = resolve(root, values.credentials ?? 'docs/dataset-accounts.md')
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
  throw new Error('Use --fixtures and --credentials /tmp/accounts.md for isolated test data')
const config = loadConfig({
  ...process.env,
  AGENT_PROVIDER: values.fixtures ? 'fixture' : 'disabled',
  ALLOW_UNCAPPED_LLM: 'false',
})
if (!config.DATABASE_URL) throw new Error('Set DATABASE_URL before seeding accounts')
if (values.fixtures && !values.credentials)
  throw new Error(
    'Fixture credentials need a separate output path; do not overwrite the dataset list',
  )
const data = await createData(config)
const ids = [...data.companies.companies]
  .filter(([, rows]) => rows.some((row) => row.clientType === 'CLIENT'))
  .map(([id]) => id)
  .sort()
const existing = new Map<string, string>()
if (existsSync(target)) {
  for (const line of (await readFile(target, 'utf8')).split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim().replaceAll('`', ''))
    if (cells[1]?.startsWith('U_') && /^dataset-[A-Za-z0-9_-]{24}$/.test(cells[3] ?? ''))
      existing.set(cells[1], cells[3]!)
  }
}
const accounts: DatasetAccount[] = ids.map((companyId) => ({
  companyId,
  username: 'client_' + companyId.toLowerCase(),
  password: existing.get(companyId) ?? 'dataset-' + randomBytes(18).toString('base64url'),
}))
const document = [
  '# Аккаунты компаний датасета',
  '',
  'Созданы командой pnpm db:seed. Один аккаунт имеет доступ только к своей компании CLIENT.',
  'Это опубликованные пароли для проверки продукта на обезличенном наборе. Пароли пользователей, созданных формой регистрации, сюда не записываются.',
  'В production вход этими аккаунтами по умолчанию отключён; явное включение — ALLOW_DATASET_LOGIN=true.',
  '',
  'Количество аккаунтов: ' + accounts.length + '.',
  '',
  '| Компания | Логин | Пароль |',
  '| --- | --- | --- |',
  ...accounts.map((a) => '| ' + a.companyId + ' | ' + a.username + ' | ' + a.password + ' |'),
  '',
].join('\n')
await mkdir(dirname(target), { recursive: true })
const temp = target + '.tmp'
await writeFile(temp, document)
const database = createDatabase(config.DATABASE_URL)
try {
  await seedDatasetAccounts(database.db, accounts)
  await rename(temp, target)
  process.stdout.write(
    'Seeded ' + accounts.length + ' company accounts. Credentials: ' + target + '\n',
  )
} finally {
  await database.pool.end()
  await unlink(temp).catch(() => {})
}
