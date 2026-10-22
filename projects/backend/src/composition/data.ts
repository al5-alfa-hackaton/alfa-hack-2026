import { fileURLToPath } from 'node:url'
import { loadDataContext, loadCompanyStore, buildDataContext } from '@alfa/research-agent'
import type { Config } from '../config.js'
export async function createData(config: Config) {
  if (config.AGENT_PROVIDER === 'langgraph') return loadDataContext({ DATA_DIR: config.DATA_DIR! })
  const fixture = (name: string) =>
    fileURLToPath(new URL(`../../fixtures/${name}.csv`, import.meta.url))
  const companies = await loadCompanyStore({
    companies: fixture('companies'),
    personLinks: fixture('links'),
    payments: fixture('payments'),
  })
  const text = 'Синтетическая новость: условия финансирования компаний изменились.'
  return buildDataContext(companies, { documents: [], chunks: [] }, [
    {
      id: 'news_fixture',
      sourceId: 'fixture',
      sourceName: 'Синтетический источник',
      title: 'Изменение условий финансирования — учебный пример',
      text,
      url: 'https://example.com/fixture',
      publishedAt: '2026-10-01T00:00:00.000Z',
      fetchedAt: '2026-10-01T00:00:00.000Z',
    },
  ])
}
