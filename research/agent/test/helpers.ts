import { fileURLToPath } from 'node:url'
import type { BankCorpus } from '../src/data/bank.js'
import { loadCompanyStore } from '../src/data/companies.js'
import { buildDataContext } from '../src/data/context.js'
import type { NewsItem } from '../src/data/news.js'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

const bankPage = 'Ключевая ставка сохранена на уровне 14,0%. Мы ожидаем сохранения ставки до конца года, что поддержит высокую стоимость заемного финансирования.'
export const bank: BankCorpus = {
  documents: [{ id: 'bank_test', file: 'test.pdf', title: 'Синтетический обзор ставки', publishedAt: '2026-09-11', sha256: 'x', textSource: 'pdf', pages: [bankPage] }],
  chunks: [{ id: 'bank_test_p1_0', documentId: 'bank_test', title: 'Синтетический обзор ставки', publishedAt: '2026-09-11', page: 1, start: 0, end: bankPage.length, text: bankPage }],
}

export const news: NewsItem[] = [
  {
    id: 'news_rate',
    sourceId: 'cbr_press',
    sourceName: 'Банк России — пресс-релизы',
    title: 'Банк России сохранил ключевую ставку 14%',
    text: 'Совет директоров Банка России принял решение сохранить ключевую ставку на уровне 14,00% годовых.',
    url: 'https://www.cbr.ru/press/test',
    publishedAt: '2026-09-11T10:30:00.000Z',
    fetchedAt: '2026-09-11T11:00:00.000Z',
  },
  {
    id: 'news_steel',
    sourceId: 'interfax',
    sourceName: 'Интерфакс',
    title: 'Экспорт стали в Китай вырос',
    text: 'Поставки российской стали в Китай увеличились на 12% за квартал.',
    url: 'https://www.interfax.ru/test',
    publishedAt: '2026-09-20T08:00:00.000Z',
    fetchedAt: '2026-09-20T09:00:00.000Z',
  },
]

export async function fixtureContext() {
  const companies = await loadCompanyStore({
    companies: fixture('companies.csv'),
    personLinks: fixture('links.csv'),
    payments: fixture('payments.csv'),
  })
  return buildDataContext(companies, bank, news)
}
