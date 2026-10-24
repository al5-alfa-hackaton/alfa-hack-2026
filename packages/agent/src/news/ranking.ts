import type { DataContext } from '../data/context.js'
import { isWarNews, type NewsItem } from '../data/news.js'
import { Bm25, tokenize } from '../search/bm25.js'
import { companyCounterparties, companyGroup, companyProfile } from '../tools/functions.js'
import { okvedGroup, sameIndustry, type NewsTag, type NewsTags, type Topic } from './tagging.js'

export const ML_RANKING_VERSION = 'ml-tags-2026-10-24.3'

export type Perspective = 'cfo' | 'ceo'
export type RankingExplanation = { featureId: string; signal: string; weight: number }
export type RankedNewsItem = {
  news: Pick<NewsItem, 'id' | 'title' | 'text' | 'publishedAt' | 'sourceId'>
  relevance: {
    score: number
    rank: number
    reasons: string[]
    version: string
    components: { companyFit: number; perspectiveFit: number; freshness: number; sourceQuality: number }
    explanations: RankingExplanation[]
    relatedNewsIds: string[]
  }
}
export type RankOptions = {
  perspective: Perspective
  asOf: string
  limit?: number
  since?: string
  until?: string
}

type Exposure = { featureId: string; weight: number; signal: string; divisions?: Set<string>; topics?: Topic[]; broadWeight?: number }

const DAY = 86_400_000
const MAX_AGE_DAYS = 90
const FRESHNESS_DAYS = 14
const MIN_SHARE = 0.1
const HOLDING_DIVISIONS = new Set(['64', '70'])
const DIVISION_ONLY_FACTOR = 0.5
const MAX_REASONS = 3
const SAME_EVENT_OVERLAP = 0.5
const SAME_EVENT_DAYS = 2
const MATERIALITY = [0, 0.5, 0.8, 1] as const
const PERSPECTIVE_TOPICS: Record<Perspective, Topic[]> = {
  cfo: ['key_rate', 'credit', 'fx', 'inflation'],
  ceo: ['demand', 'trade', 'commodities', 'labor', 'regulation'],
}
const PRODUCT_WEIGHTS = [
  ['loans', 0.5, 'Кредиты в Альфа-Банке'],
  ['leasing', 0.35, 'Лизинг в Альфа-Банке'],
  ['factoring', 0.25, 'Факторинг в Альфа-Банке'],
  ['guarantees', 0.2, 'Гарантии в Альфа-Банке'],
] as const

const round = (n: number) => Math.round(n * 10_000) / 10_000

function shareWeight(base: number, share: number) {
  return base * Math.min(1, share * 2)
}

type OkvedName = { group: string; name: string }
const INDUSTRY_SYNONYMS: [RegExp, string][] = [
  [/(^|[^а-яa-z])(it|ит|айти)([^а-яa-z]|$)|софт|программ/i, 'разработка компьютерного программного обеспечения'],
  [/грузоперевоз|перевозк\S* груз|автоперевоз/i, 'перевозка грузов автомобильным транспортом'],
  [/логистик|склад/i, 'транспортная обработка грузов складирование'],
  [/ритейл|магазин/i, 'торговля розничная'],
  [/дистрибуц|опт(?![а-я])/i, 'торговля оптовая'],
  [/стройк|девелоп|застройщ/i, 'строительство жилых и нежилых зданий'],
  [/ресторан|кафе|общепит/i, 'деятельность ресторанов и услуги по доставке продуктов питания'],
  [/отел|гостиниц|хостел/i, 'деятельность гостиниц'],
  [/агро|фермер|сельск/i, 'выращивание сельскохозяйственных культур'],
  [/медицин|клиник/i, 'общая врачебная практика'],
  [/аптек|аптеч/i, 'торговля розничная лекарственными средствами в специализированных магазинах аптеках'],
  [/фарм/i, 'торговля оптовая фармацевтической продукцией'],
  [/стройматериал/i, 'строительными материалами лесоматериалами санитарно-техническим оборудованием'],
  [/металлоконструкц/i, 'производство строительных металлических конструкций'],
  [/электроник/i, 'компьютерами бытовыми электротоварами'],
  [/консалтинг|консультир/i, 'консультирование по вопросам коммерческой деятельности и управления'],
]
const GENERIC_INDUSTRY_WORDS = new Set(tokenize('производство торговля оптовая розничная деятельность услуги предоставление прочих прочая прочие специализированных магазинах компания сеть'))
const okvedIndexes = new WeakMap<DataContext['companies'], Bm25<OkvedName>>()

export function inferOkvedGroup(ctx: DataContext, industry: string): string | null {
  let index = okvedIndexes.get(ctx.companies)
  if (!index) {
    const names = new Map<string, string>()
    for (const rows of ctx.companies.companies.values()) {
      const c = rows[0]
      const group = okvedGroup(c?.okvedCode)
      if (group && c?.okvedName && !names.has(c.okvedName)) names.set(c.okvedName, group)
    }
    index = new Bm25([...names].map(([name, group]) => ({ name, group })), (n) => n.name)
    okvedIndexes.set(ctx.companies, index)
  }
  const query = [industry, ...INDUSTRY_SYNONYMS.filter(([re]) => re.test(industry)).map(([, words]) => words)].join(' ')
  const specific = new Set(tokenize(query).filter((t) => !GENERIC_INDUSTRY_WORDS.has(t)))
  const votes = new Map<string, number>()
  for (const hit of index.search(query, 10)) {
    if (!tokenize(hit.item.name).some((t) => specific.has(t))) continue
    votes.set(hit.item.group, (votes.get(hit.item.group) ?? 0) + hit.score)
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export function companyExposures(ctx: DataContext, companyId: string): Exposure[] {
  const { company, derived } = companyProfile(ctx, companyId)
  const exposures: Exposure[] = []
  const inferred = !company.okvedCode && company.okvedName ? inferOkvedGroup(ctx, company.okvedName) : null
  const ownGroup = okvedGroup(company.okvedCode) ?? inferred
  if (ownGroup)
    exposures.push({
      featureId: 'industry',
      weight: 0.7,
      broadWeight: 0.4,
      signal: inferred ? `Отрасль события совпадает с отраслью из профиля «${company.okvedName}» (ОКВЭД ${ownGroup})` : `Отрасль события совпадает с отраслью компании (ОКВЭД ${ownGroup})`,
      divisions: new Set([ownGroup]),
    })

  const group = companyGroup(ctx, companyId)
  if (group.groupSize > 1)
    for (const d of group.groupOkvedDivisions) {
      const share = d.companies / group.groupSize
      if (share < MIN_SHARE || d.okvedDivision === derived.okvedDivision || HOLDING_DIVISIONS.has(d.okvedDivision)) continue
      exposures.push({ featureId: 'group_industries', weight: shareWeight(0.35, share), signal: `Отрасль ${d.okvedDivision} — у ${Math.round(share * 100)}% компаний группы`, divisions: new Set([d.okvedDivision]) })
    }

  const counterparties = companyCounterparties(ctx, companyId) as Record<string, { industriesReliable: boolean; industriesByAmount: { okvedDivision: string; share: number }[] } | undefined>
  for (const [side, featureId, label] of [
    ['suppliers', 'supplier_industries', 'поставщиков'],
    ['customers', 'customer_industries', 'покупателей'],
  ] as const) {
    const s = counterparties[side]
    if (!s?.industriesReliable) continue
    for (const d of s.industriesByAmount) {
      if (d.share < MIN_SHARE) continue
      exposures.push({ featureId, weight: shareWeight(0.4, d.share), signal: `Отрасль ${d.okvedDivision} — ${Math.round(d.share * 100)}% платежей ${label}`, divisions: new Set([d.okvedDivision]) })
    }
  }

  for (const [featureId, weight, label] of PRODUCT_WEIGHTS)
    if (company.products[featureId]) exposures.push({ featureId, weight, signal: `${label}: событие о ставке или условиях заимствований`, topics: ['key_rate', 'credit'] })
  if (company.products.deposits) exposures.push({ featureId: 'deposits', weight: 0.15, signal: 'Депозиты в Альфа-Банке: событие о ставке', topics: ['key_rate'] })
  if (company.customs.hasRecords) exposures.push({ featureId: 'customs', weight: 0.4, signal: 'Есть внешняя торговля: событие о курсе, санкциях или пошлинах', topics: ['fx', 'trade'] })
  if (company.products.payroll) exposures.push({ featureId: 'payroll', weight: 0.3, signal: 'Зарплатный проект: событие о рынке труда', topics: ['labor'] })
  return exposures
}

const isDivisionOnly = (code: string) => !code.includes('.')

function touchesCompany(tag: NewsTag, exposures: Exposure[]): boolean {
  if (tag.scope === 'macro' || !tag.divisions.length) return true
  return exposures.some((e) => e.divisions && tag.divisions.some((d) => [...e.divisions!].some((x) => !isDivisionOnly(x) && sameIndustry(d, x))))
}

function matchWeight(exposure: Exposure, tag: NewsTag, relevantSector: boolean): number {
  if (exposure.divisions) {
    const codes = [...exposure.divisions]
    if (tag.divisions.some((d) => codes.includes(d))) return exposure.weight
    if (!tag.divisions.some((d) => codes.some((x) => sameIndustry(d, x)))) return 0
    return exposure.broadWeight ?? (codes.every(isDivisionOnly) ? exposure.weight * DIVISION_ONLY_FACTOR : exposure.weight)
  }
  return relevantSector && tag.topics.some((t) => exposure.topics!.includes(t)) ? exposure.weight : 0
}

export function directlyAffected(tag: NewsTag, exposures: Exposure[]): boolean {
  const own = exposures.find((e) => e.featureId === 'industry')?.divisions
  if (!own || tag.scope === 'macro' || tag.scope === 'other' || tag.materiality < 2) return false
  return tag.divisions.some((d) => [...own].some((o) => d.replace('.', '').startsWith(o.replace('.', ''))))
}

export function sameEvent(a: Pick<NewsItem, 'title' | 'publishedAt'>, b: Pick<NewsItem, 'title' | 'publishedAt'>): boolean {
  const days = Math.abs(Date.parse(a.publishedAt ?? '') - Date.parse(b.publishedAt ?? '')) / DAY
  if (!(days <= SAME_EVENT_DAYS)) return false
  const x = new Set(tokenize(a.title))
  const y = new Set(tokenize(b.title))
  if (Math.min(x.size, y.size) < 4) return false
  const common = [...x].filter((t) => y.has(t)).length
  return common / Math.min(x.size, y.size) >= SAME_EVENT_OVERLAP
}

export function rankNewsForCompany(ctx: DataContext, tags: NewsTags, companyId: string, opts: RankOptions): RankedNewsItem[] {
  const at = Date.parse(opts.asOf)
  if (!Number.isFinite(at)) throw new Error('Invalid ranking reference date')
  const since = opts.since ? Date.parse(opts.since) : -Infinity
  const until = opts.until ? Date.parse(opts.until) : Infinity
  const exposures = companyExposures(ctx, companyId)
  const candidates: RankedNewsItem[] = []

  for (const news of ctx.news) {
    const tag = tags.get(news.id)
    if (!tag || tag.scope === 'other' || tag.materiality === 0) continue
    const date = news.publishedAt ? Date.parse(news.publishedAt) : NaN
    if (!Number.isFinite(date) || date > at + 5 * 60_000 || at - date > MAX_AGE_DAYS * DAY || date < since || date > until) continue

    const relevantSector = touchesCompany(tag, exposures)
    const matched = exposures.flatMap((e) => {
      const weight = matchWeight(e, tag, relevantSector)
      return weight > 0 ? [{ ...e, weight }] : []
    })
    if (!matched.length) continue
    if (isWarNews(news) && !directlyAffected(tag, exposures)) continue
    const companyFit = 1 - matched.reduce((p, e) => p * (1 - e.weight), 1)
    const perspectiveFit = tag.topics.some((t) => PERSPECTIVE_TOPICS[opts.perspective].includes(t)) ? 1 : 0.4
    const freshness = Math.exp(-Math.max(0, at - date) / (FRESHNESS_DAYS * DAY))
    const sourceQuality = news.sourceId.startsWith('cbr') ? 1 : 0.65
    const score =
      0.65 * companyFit * MATERIALITY[tag.materiality] + 0.15 * perspectiveFit + 0.15 * freshness + 0.05 * sourceQuality

    candidates.push({
      news: { id: news.id, title: news.title, text: news.text, publishedAt: news.publishedAt, sourceId: news.sourceId },
      relevance: {
        score: round(score),
        rank: 0,
        reasons: [...new Set([...matched].sort((a, b) => b.weight - a.weight).map((e) => e.featureId))].slice(0, MAX_REASONS),
        version: ML_RANKING_VERSION,
        components: { companyFit: round(companyFit), perspectiveFit, freshness: round(freshness), sourceQuality },
        explanations: [...matched]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, MAX_REASONS)
          .map((e) => ({ featureId: e.featureId, signal: e.signal, weight: round(e.weight) })),
        relatedNewsIds: [],
      },
    })
  }

  candidates.sort(
    (a, b) =>
      b.relevance.score - a.relevance.score ||
      (b.news.publishedAt ?? '').localeCompare(a.news.publishedAt ?? '') ||
      a.news.id.localeCompare(b.news.id),
  )
  const picked: RankedNewsItem[] = []
  for (const c of candidates) {
    if (picked.length >= (opts.limit ?? 5)) break
    const same = picked.find((p) => sameEvent(p.news, c.news))
    if (same) {
      same.relevance.relatedNewsIds.push(c.news.id)
      continue
    }
    picked.push(c)
  }
  return picked.map((c, i) => ({ ...c, relevance: { ...c.relevance, rank: i + 1 } }))
}

export function tagCoverage(ctx: DataContext, tags: NewsTags) {
  return { news: ctx.news.length, tagged: ctx.news.filter((n) => tags.has(n.id)).length }
}
