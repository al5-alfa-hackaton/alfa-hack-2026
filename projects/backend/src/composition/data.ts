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
      publishedAt: '2026-10-21T00:00:00.000Z',
      fetchedAt: '2026-10-21T00:00:00.000Z',
    },
    ...[
      {
        id: 'news_fixture_steel',
        title: 'Спрос на сталь — учебный пример',
        text: 'Синтетическая новость: спрос на сталь и металлопрокат изменился.',
      },
      {
        id: 'news_fixture_coal',
        title: 'Поставки угля — учебный пример',
        text: 'Синтетическая новость: изменились условия поставок угля.',
      },
      {
        id: 'news_fixture_retail',
        title: 'Розничные продажи — учебный пример',
        text: 'Синтетическая новость: изменился спрос в магазинах розничной торговли.',
      },
    ].map((n) => ({
      ...n,
      sourceId: 'fixture',
      sourceName: 'Синтетический источник',
      url: 'https://example.com/' + n.id,
      publishedAt: '2026-10-21T00:00:00.000Z',
      fetchedAt: '2026-10-21T00:00:00.000Z',
    })),
  ])
}
