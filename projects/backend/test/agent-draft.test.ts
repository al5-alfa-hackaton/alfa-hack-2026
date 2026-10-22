import { describe, expect, it } from 'vitest'
import { parseDraftBatch } from '../src/modules/analytics/infrastructure/agent-draft.js'

const claim = {
  kind: 'fact',
  text: 'Подтверждённая цитата из новости.',
  companyFeatureIds: [],
  uncertainty: null,
  citations: [{ documentId: 'news_1', quote: 'Подтверждённая цитата из новости.' }],
}

describe('per-claim draft validation', () => {
  it('bounds claims without discarding the whole event', () => {
    const [draft] = parseDraftBatch({
      events: [{ eventId: 'news_1', claims: Array(16).fill(claim) }],
    })
    expect(draft!.claims).toHaveLength(15)
    expect(draft!.rejectedClaims).toBe(1)
  })
  it('keeps valid events and claims when neighboring entries are malformed', () => {
    const drafts = parseDraftBatch({
      events: [
        null,
        {
          eventId: 'news_1',
          summary: 'Краткий смысл для компании.',
          kind: 'risk',
          answer: 'Прямой ответ на вопрос.',
          risks: ['Процентные расходы могут вырасти.'],
          opportunities: [],
          actions: ['Проверить ставку по кредиту.'],
          claims: [
            claim,
            { ...claim, citations: [{ documentId: 'news_1', quote: 'x'.repeat(301) }] },
            null,
          ],
        },
        { eventId: 'news_2', claims: [claim] },
      ],
    })
    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({
      kind: 'risk',
      summary: 'Краткий смысл для компании.',
      answer: 'Прямой ответ на вопрос.',
      rejectedClaims: 2,
    })
    expect(drafts[0]!.claims).toHaveLength(1)
    expect(drafts[0]!.risks).toHaveLength(1)
    expect(drafts[0]!.actions).toHaveLength(1)
    expect(drafts[1]!.risks).toEqual([])
  })
  it('ignores invalid optional metadata without dropping valid claims', () => {
    const [draft] = parseDraftBatch({
      events: [
        {
          eventId: 'news_1',
          claims: [claim],
          summary: 123,
          kind: 'invented',
          actions: 'not-an-array',
        },
      ],
    })
    expect(draft!.claims).toHaveLength(1)
    expect(draft!.summary).toBeUndefined()
    expect(draft!.kind).toBeUndefined()
    expect(draft!.actions).toEqual([])
  })
  it('rejects an invalid batch envelope and bounds the batch size', () => {
    expect(() => parseDraftBatch({ events: 'invalid' })).toThrow()
    expect(() =>
      parseDraftBatch({ events: Array(21).fill({ eventId: 'news_1', claims: [] }) }),
    ).toThrow()
  })
})
