import { mkdtemp, mkdir, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { loadConfig, type Config } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { watchNewsRefresh } from '../src/composition/news-refresh.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'

it('reloads the news corpus in place after news:refresh writes its marker', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'news-refresh-'))
  await mkdir(join(dir, 'processed'))
  const marker = join(dir, 'processed', 'news-refreshed.json')
  await writeFile(marker, '{}')
  const data = await createData(loadConfig({ NODE_ENV: 'test' }))
  const catalog = new ResearchCatalog(data, 'research')
  const before = catalog.corpusVersion
  const log = vi.fn()
  const stop = watchNewsRefresh(
    { AGENT_PROVIDER: 'langgraph', DATA_DIR: dir } as Config,
    data,
    log,
    20,
  )
  await new Promise((r) => setTimeout(r, 60))
  expect(data.news.some((n) => n.id === 'news_fixture')).toBe(true)
  const fresh = {
    id: 'news_fresh',
    sourceId: 'rbc',
    sourceName: 'РБК',
    title: 'Свежая новость о ставке',
    text: 'Банк России сохранил ключевую ставку.',
    url: 'https://www.rbc.ru/fresh',
    publishedAt: '2026-10-25T06:00:00.000Z',
    fetchedAt: '2026-10-25T06:00:00.000Z',
  }
  await writeFile(
    join(dir, 'processed', 'news.json'),
    JSON.stringify([fresh, { ...fresh, id: 'news_unknown', sourceId: 'unknown' }]),
  )
  const later = new Date(Date.now() + 5000)
  await utimes(marker, later, later)
  await vi.waitFor(() => expect(data.news.map((n) => n.id)).toEqual(['news_fresh']), {
    timeout: 2000,
  })
  stop()
  expect(data.newsIndex.search('ключевая ставка', 1)[0]?.item.id).toBe('news_fresh')
  expect(catalog.corpusVersion).not.toBe(before)
  expect(log).toHaveBeenCalledWith('News corpus reloaded: 1 items')
})
