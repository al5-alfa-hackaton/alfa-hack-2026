import { describe, expect, it } from 'vitest'
import {
  rankNews,
  RANKING_VERSION,
  type RankingNews,
} from '../src/modules/analytics/domain/ranking.js'
const at = '2026-10-22T12:00:00.000Z'
const news: RankingNews[] = [
  {
    id: 'finance',
    title: 'Ключевая ставка и стоимость кредитов',
    text: 'Изменились условия финансирования.',
    publishedAt: '2026-10-21T10:00:00Z',
    sourceId: 'cbr_press',
  },
  {
    id: 'steel',
    title: 'Спрос на сталь вырос',
    text: 'Изменились поставки металлопроката.',
    publishedAt: '2026-10-21T10:00:00Z',
    sourceId: 'interfax',
  },
  {
    id: 'retail',
    title: 'Розничные продажи выросли',
    text: 'Спрос в магазинах увеличился.',
    publishedAt: '2026-10-21T10:00:00Z',
    sourceId: 'interfax',
  },
]
const steel = [
  { id: 'industry', value: 'Производство стали и металлопроката' },
  { id: 'loans', value: 'true' },
]
describe('explainable company ranking', () => {
  it('matches gas with Cyrillic word boundaries but not unrelated words', () => {
    const gas = [{ ...news[0]!, title: 'Цены на газ снизились', text: 'Поставки газа выросли.' }]
    expect(
      rankNews(gas, [{ id: 'industry', value: 'Добыча природного газа' }], 'ceo', at),
    ).toHaveLength(1)
    expect(
      rankNews(gas, [{ id: 'industry', value: 'Розничная торговля в магазинах' }], 'ceo', at),
    ).toEqual([])
  })
  it('selects ten events by default and honors a larger explicit limit', () => {
    const corpus = Array.from({ length: 15 }, (_, index) => ({ ...news[0]!, id: `event-${index}` }))
    expect(rankNews(corpus, steel, 'cfo', at)).toHaveLength(10)
    expect(rankNews(corpus, steel, 'cfo', at, undefined, 12)).toHaveLength(12)
  })
  it('changes the selected events for different company industries', () => {
    expect(rankNews(news, steel, 'ceo', at).some((r) => r.news.id === 'steel')).toBe(true)
    const retail = rankNews(news, [{ id: 'industry', value: 'Розничная торговля' }], 'ceo', at)
    expect(retail.map((r) => r.news.id)).toEqual(['retail'])
  })
  it('changes priority for CFO and CEO using the same company profile', () => {
    expect(rankNews(news, steel, 'cfo', at)[0]!.news.id).toBe('finance')
    expect(rankNews(news, steel, 'ceo', at)[0]!.news.id).toBe('steel')
  })
  it('does not invent exposure when products and industry are unknown or false', () => {
    expect(
      rankNews(
        news,
        [
          { id: 'industry', value: null },
          { id: 'loans', value: 'false' },
          { id: 'customs', value: null },
        ],
        'cfo',
        at,
      ),
    ).toEqual([])
  })
  it('excludes future, stale and out-of-range news before model calls', () => {
    const corpus = [
      ...news,
      { ...news[0]!, id: 'future', publishedAt: '2026-10-23T00:00:00Z' },
      { ...news[0]!, id: 'stale', publishedAt: '2025-01-01T00:00:00Z' },
      { ...news[0]!, id: 'undated', publishedAt: null },
    ]
    const ranked = rankNews(corpus, steel, 'cfo', at, {
      since: '2026-10-21T00:00:00Z',
      until: '2026-10-22T00:00:00Z',
    })
    expect(ranked.map((r) => r.news.id)).toEqual(['finance', 'steel'])
  })
  it('keeps valid undated matches low and prefers newer evidence at equal affinity', () => {
    const ranked = rankNews(
      [
        { ...news[0]!, id: 'old', publishedAt: null },
        { ...news[0]!, id: 'new' },
      ],
      steel,
      'cfo',
      at,
    )
    expect(ranked[0]!.news.id).toBe('new')
  })
  it('makes tie breaking and duplicate IDs deterministic', () => {
    const corpus = [
      { ...news[0]!, id: 'b' },
      { ...news[0]!, id: 'a' },
      { ...news[0]!, id: 'b' },
    ]
    const a = rankNews(corpus, steel, 'cfo', at),
      b = rankNews(corpus.reverse(), steel, 'cfo', at)
    expect(a).toEqual(b)
    expect(a.map((r) => r.news.id)).toEqual(['a', 'b'])
    expect(a.map((r) => r.relevance.rank)).toEqual([1, 2])
  })
  it('returns bounded scores, version and feature-linked explanations', () => {
    for (const item of rankNews(news, steel, 'cfo', at)) {
      expect(item.relevance.score).toBeGreaterThan(0)
      expect(item.relevance.score).toBeLessThanOrEqual(1)
      expect(item.relevance.version).toBe(RANKING_VERSION)
      expect(item.relevance.explanations?.length).toBeGreaterThan(0)
      expect(item.relevance.reasons.every((id) => steel.some((f) => f.id === id))).toBe(true)
    }
  })
  it('uses observed counterparty sectors with a smaller contribution than the own industry', () => {
    const direct = rankNews(news, [{ id: 'industry', value: 'Розничная торговля' }], 'ceo', at)[0]!
    const related = rankNews(
      news,
      [{ id: 'supplier_industries', value: 'Розничная торговля' }],
      'ceo',
      at,
    )[0]!
    expect(related.relevance.score).toBeLessThan(direct.relevance.score)
    expect(related.relevance.reasons).toEqual(['supplier_industries'])
  })
  it('does not infer export direction from customs countries', () => {
    const [r] = rankNews(
      [{ ...news[0]!, title: 'Курс валют изменился' }],
      [{ id: 'customs', value: 'Китай, Турция' }],
      'cfo',
      at,
    )
    expect(r!.relevance.explanations![0]!.signal).toContain(
      'направление торговли и валюта неизвестны',
    )
  })
})
