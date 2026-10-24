import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dataPaths, type Config } from '../config.js'
import { Bm25 } from '../search/bm25.js'
import type { BankChunk, BankCorpus } from './bank.js'
import { loadCompanyStore, type CompanyStore } from './companies.js'
import { NEWS_SOURCE_IDS, type NewsItem } from './news.js'

export type DataContext = {
  companies: CompanyStore
  bank: BankCorpus
  bankIndex: Bm25<BankChunk>
  news: NewsItem[]
  newsIndex: Bm25<NewsItem>
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback
  return JSON.parse(await readFile(path, 'utf8')) as T
}

export function buildDataContext(companies: CompanyStore, bank: BankCorpus, news: NewsItem[]): DataContext {
  return {
    companies,
    bank,
    bankIndex: new Bm25(bank.chunks, (c) => `${c.title} ${c.text}`),
    news,
    newsIndex: new Bm25(news, (n) => `${n.title} ${n.title} ${n.text}`),
  }
}

export async function loadDataContext(config: Pick<Config, 'DATA_DIR'>): Promise<DataContext> {
  const paths = dataPaths(config)
  const [companies, bank, news] = await Promise.all([
    loadCompanyStore(paths),
    readJson<BankCorpus>(paths.bankChunks, { documents: [], chunks: [] }),
    readJson<NewsItem[]>(paths.news, []),
  ])
  return buildDataContext(companies, bank, news.filter((n) => NEWS_SOURCE_IDS.has(n.sourceId)))
}

export async function reloadNews(ctx: DataContext, config: Pick<Config, 'DATA_DIR'>): Promise<number> {
  const news = (await readJson<NewsItem[]>(dataPaths(config).news, [])).filter((n) => NEWS_SOURCE_IDS.has(n.sourceId))
  ctx.newsIndex = new Bm25(news, (n) => `${n.title} ${n.title} ${n.text}`)
  ctx.news = news
  return news.length
}
