import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'
import { normalizeForMatch, stripHtml } from './text.js'

export type NewsSource = { id: string; name: string; url: string; kind: 'regulator' | 'media' }

export const NEWS_SOURCES: NewsSource[] = [
  { id: 'cbr_events', name: 'Банк России — события', url: 'https://www.cbr.ru/rss/eventrss', kind: 'regulator' },
  { id: 'cbr_press', name: 'Банк России — пресс-релизы', url: 'https://www.cbr.ru/rss/RssPress', kind: 'regulator' },
  { id: 'interfax', name: 'Интерфакс', url: 'https://www.interfax.ru/rss.asp', kind: 'media' },
  { id: 'rbc', name: 'РБК', url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss', kind: 'media' },
  { id: 'kommersant', name: 'Коммерсантъ', url: 'https://www.kommersant.ru/RSS/news.xml', kind: 'media' },
  { id: 'vedomosti', name: 'Ведомости', url: 'https://www.vedomosti.ru/rss/news', kind: 'media' },
  { id: 'banki', name: 'Банки.ру', url: 'https://www.banki.ru/xml/news.rss', kind: 'media' },
]

export const NEWS_SOURCE_IDS = new Set(NEWS_SOURCES.map((s) => s.id))

const WAR_TERMS = new RegExp(
  [
    '(?<![А-Яа-яЁёA-Za-z])(?:СВО|ВСУ|ПВО|ЗАЭС|БПЛА|ВС РФ|ВС России)(?![А-Яа-яЁёA-Za-z])',
    'беспилотн',
    '(?<![а-яё])дрон',
    'обстрел',
    'ракетн\\S* удар',
    'боев\\S* действ',
    'Минобороны',
    'мобилизац',
    'Украин',
    'Киев',
    'Зеленск',
    'линии фронта',
    'на фронте',
    'удар\\S* по (?:объект|склад|судн|порт|железнодорож|энергетич)',
    'атак\\S* (?:ВСУ|БПЛА|дрон)',
    '[Мм]инобороны',
    '[Хх]усит',
    '(?<![А-Яа-яЁёA-Za-z])(?:КСИР|ХАМАС|ЦАХАЛ|НАТО|ВВС)(?![А-Яа-яЁёA-Za-z])',
    '[Хх]езболл',
    '[Аа]виаудар',
    '[Пп]еремири',
    '[Бб]оевик',
    '[Вв]оенн\\S* (?:операц|конфликт|удар|действ|эскалац)',
    '[Вв]ооруженн\\S* (?:сил|конфликт)',
    '[Рр]акет',
    '[Пп]огиб\\S* при (?:удар|атак|нападени)',
    'сектор[аеу]? Газа|в Газе',
    'Израил\\S* (?:удар|арми|нан[её]с|атак)',
    'Иран\\S* (?:удар|пригроз|атак)|удар\\S* по Иран',
    'Судан|Йемен|Ормузск',
    '(?<!экономическ\\S{2} )(?<![а-яё])войн[аеуыо]? (?:в|во|с|против|на) [А-ЯЁ]',
    'подготовк\\S* .*к войне',
  ].join('|'),
)

export function isWarNews(item: Pick<NewsItem, 'title'>): boolean {
  return WAR_TERMS.test(item.title)
}


const ALLOWED_HOSTS = new Set(NEWS_SOURCES.map((s) => new URL(s.url).host))
const MAX_FEED_BYTES = 5 * 1024 * 1024

export type NewsItem = {
  id: string
  sourceId: string
  sourceName: string
  title: string
  text: string
  url: string
  publishedAt: string | null
  fetchedAt: string
  textSource?: 'rss' | 'article'
}

const parser = new XMLParser({ ignoreAttributes: true, processEntities: true, trimValues: true })

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && '#text' in value) return String((value as { '#text': unknown })['#text'])
  return ''
}

function toIso(date: string): string | null {
  const t = Date.parse(date)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export function parseFeed(xml: string, source: NewsSource, fetchedAt: string): NewsItem[] {
  const doc = parser.parse(xml)
  const raw = doc?.rss?.channel?.item ?? []
  const items: unknown[] = Array.isArray(raw) ? raw : [raw]
  return items.flatMap((it) => {
    const r = it as Record<string, unknown>
    const title = stripHtml(asText(r.title))
    const url = asText(r.link).trim()
    if (!title || !url) return []
    const body = stripHtml(asText(r['rbc_news:full-text']) || asText(r['yandex:full-text']) || asText(r.description))
    return [{
      id: `news_${createHash('sha1').update(url).digest('hex').slice(0, 12)}`,
      sourceId: source.id,
      sourceName: source.name,
      title,
      text: body,
      url,
      publishedAt: toIso(asText(r.pubDate)),
      fetchedAt,
    }]
  })
}

function assertAllowed(url: URL) {
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.host)) throw new Error(`Host not allowed: ${url.host}`)
}

export async function fetchFeed(source: NewsSource, signal?: AbortSignal): Promise<NewsItem[]> {
  let url = new URL(source.url)
  for (let hop = 0; hop <= 3; hop++) {
    assertAllowed(url)
    const response = await fetch(url, { headers: { 'user-agent': 'alfa-hack-research/0.1' }, redirect: 'manual', signal })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`)
    const body = await response.text()
    if (body.length > MAX_FEED_BYTES) throw new Error(`${source.id}: feed too large`)
    return parseFeed(body, source, new Date().toISOString())
  }
  throw new Error(`${source.id}: too many redirects`)
}

export function mergeNews(existing: NewsItem[], incoming: NewsItem[]): NewsItem[] {
  const kept = existing.filter((n) => NEWS_SOURCE_IDS.has(n.sourceId))
  const byId = new Map(kept.map((n) => [n.id, n]))
  const titles = new Set(kept.map((n) => normalizeForMatch(n.title)))
  for (const item of incoming) {
    const key = normalizeForMatch(item.title)
    if (byId.has(item.id) || titles.has(key)) continue
    byId.set(item.id, item)
    titles.add(key)
  }
  return [...byId.values()].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}
