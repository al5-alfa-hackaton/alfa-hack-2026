import { FakeListChatModel } from '@langchain/core/utils/testing'
import { describe, expect, it } from 'vitest'
import { buildDataContext } from '../src/data/context.js'
import type { NewsItem } from '../src/data/news.js'
import { companyExposures, rankNewsForCompany } from '../src/news/ranking.js'
import { okvedDivisions, parseTagResponse, tagNewsBatch, type NewsTag } from '../src/news/tagging.js'
import { bank, fixtureContext, news } from './helpers.js'

const base = await fixtureContext()
const asOf = '2026-09-25T00:00:00.000Z'

const extra = (id: string, title: string, publishedAt: string): NewsItem => ({
  id,
  sourceId: 'kommersant',
  sourceName: 'Коммерсантъ',
  title,
  text: '',
  url: `https://www.kommersant.ru/${id}`,
  publishedAt,
  fetchedAt: publishedAt,
})

const corpus = [
  ...news,
  extra('news_court', 'Суд взыскал с иностранного банка €342 млн', '2026-09-24T08:00:00.000Z'),
  extra('news_steel_dup', 'Экспорт стали в Китай вырос на 12%', '2026-09-21T08:00:00.000Z'),
  extra('news_football', 'Сборная выиграла товарищеский матч', '2026-09-24T09:00:00.000Z'),
  extra('news_old', 'Банк России повысил ключевую ставку', '2026-05-01T08:00:00.000Z'),
  extra('news_untagged', 'Цены на сталь выросли', '2026-09-24T10:00:00.000Z'),
  extra('news_housing', 'Ипотека для новостроек подорожала', '2026-09-24T11:00:00.000Z'),
]
const ctx = buildDataContext(base.companies, bank, corpus)

const tag = (t: Partial<NewsTag>): NewsTag => ({ divisions: [], topics: [], scope: 'sector', materiality: 2, ...t })
const tags = new Map<string, NewsTag>([
  ['news_rate', tag({ topics: ['key_rate', 'credit'], scope: 'macro', materiality: 3 })],
  ['news_steel', tag({ divisions: ['24'], topics: ['trade', 'demand'] })],
  ['news_steel_dup', tag({ divisions: ['24'], topics: ['trade'] })],
  ['news_court', tag({ divisions: ['64'], scope: 'company', materiality: 1 })],
  ['news_housing', tag({ divisions: ['41.2'], topics: ['credit', 'demand'], materiality: 2 })],
  ['news_football', tag({ scope: 'other', materiality: 0 })],
  ['news_old', tag({ topics: ['key_rate'], scope: 'macro', materiality: 3 })],
])

describe('news tagging', () => {
  const divisions = okvedDivisions(base.companies)

  it('builds the OKVED division dictionary from company data', () => {
    expect(divisions.map((d) => d.code)).toEqual(['05.1', '24.1', '46.7'])
    expect(divisions[1]!.name).toContain('Производство чугуна')
  })

  it('validates model output and drops unknown ids, divisions and topics', () => {
    const parsed = parseTagResponse(
      '```json\n[{"id":"news_rate","divisions":["24.10","99"],"topics":["key_rate","weather"],"scope":"macro","materiality":3},{"id":"news_x","divisions":[],"topics":[],"scope":"macro","materiality":1},{"id":"news_steel","scope":"wrong","materiality":2}]\n```',
      ['news_rate', 'news_steel'],
      new Set(divisions.map((d) => d.code)),
    )
    expect([...parsed.keys()]).toEqual(['news_rate'])
    expect(parsed.get('news_rate')).toEqual({ divisions: ['24.1'], topics: ['key_rate'], scope: 'macro', materiality: 3 })
  })

  it('tags a batch with one model call', async () => {
    const model = new FakeListChatModel({
      responses: ['[{"id":"news_rate","divisions":[],"topics":["key_rate"],"scope":"macro","materiality":3},{"id":"news_steel","divisions":["24"],"topics":["trade"],"scope":"sector","materiality":2}]'],
    })
    const { tags: result } = await tagNewsBatch(model, divisions, news)
    expect(result.get('news_steel')).toMatchObject({ divisions: ['24'], scope: 'sector' })
    expect(result.size).toBe(2)
  })
})

describe('ML news ranking', () => {
  it('derives exposures from the company profile, group and products', () => {
    const ids = companyExposures(ctx, 'U_1').map((e) => e.featureId)
    expect(ids).toEqual(expect.arrayContaining(['industry', 'group_industries', 'loans', 'customs', 'payroll']))
    expect(ids).not.toContain('leasing')
  })

  it('keeps only events linked to the company and drops other-scope, stale and untagged news', () => {
    const ranked = rankNewsForCompany(ctx, tags, 'U_1', { perspective: 'cfo', asOf, limit: 5 })
    expect(ranked.map((r) => r.news.id).sort()).toEqual(['news_rate', 'news_steel_dup'])
    expect(ranked.every((r) => r.relevance.components.companyFit < 1)).toBe(true)
    const steel = ranked.find((r) => r.news.id === 'news_steel_dup')!
    expect(steel.relevance.reasons).toEqual(expect.arrayContaining(['industry', 'customs']))
    expect(steel.relevance.explanations[0]!.signal).toMatch(/Отрасль события совпадает/)
  })

  it('keeps the fresher of near-duplicate stories', () => {
    const ids = rankNewsForCompany(ctx, tags, 'U_1', { perspective: 'ceo', asOf, limit: 5 }).map((r) => r.news.id)
    expect(ids).toContain('news_steel_dup')
    expect(ids).not.toContain('news_steel')
  })

  it('shifts scores by perspective: rate news for CFO, trade news for CEO', () => {
    const score = (perspective: 'cfo' | 'ceo', id: string) =>
      rankNewsForCompany(ctx, tags, 'U_1', { perspective, asOf, limit: 5 }).find((r) => r.news.id === id)!.relevance
    expect(score('cfo', 'news_rate').score).toBeGreaterThan(score('ceo', 'news_rate').score)
    expect(score('ceo', 'news_steel_dup').score).toBeGreaterThan(score('cfo', 'news_steel_dup').score)
    expect(score('ceo', 'news_steel_dup').rank).toBe(1)
  })

  it('does not rank sector news for a company outside the sector', () => {
    const ranked = rankNewsForCompany(ctx, tags, 'U_3', { perspective: 'ceo', asOf })
    expect(ranked.map((r) => r.news.id)).not.toContain('news_steel')
    expect(ranked.map((r) => r.news.id)).not.toContain('news_court')
  })

  it('ignores product channels for sector news of unrelated industries', () => {
    const ids = rankNewsForCompany(ctx, tags, 'U_1', { perspective: 'cfo', asOf, limit: 5 }).map((r) => r.news.id)
    expect(ids).not.toContain('news_housing')
  })

  it('matches a whole OKVED division to its groups', () => {
    const divisionTags = new Map<string, NewsTag>([['news_steel', tag({ divisions: ['24'] })]])
    expect(rankNewsForCompany(ctx, divisionTags, 'U_1', { perspective: 'ceo', asOf }).map((r) => r.news.id)).toEqual(['news_steel'])
  })

  it('applies the requested period', () => {
    const ranked = rankNewsForCompany(ctx, tags, 'U_1', { perspective: 'cfo', asOf, since: '2026-09-15T00:00:00.000Z' })
    expect(ranked.map((r) => r.news.id)).toEqual(['news_steel_dup'])
  })
})
