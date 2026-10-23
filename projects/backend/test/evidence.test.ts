import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { gateDraft } from '../src/modules/analytics/infrastructure/agent-runtime.js'
describe('publication gate', () => {
  it('excludes citations added by the formatter and allows the guarantees feature', async () => {
    const ctx = await createData(loadConfig({ NODE_ENV: 'test' }))
    const quote = ctx.news[0]!.text
    const draft = {
      claims: [
        {
          kind: 'fact' as const,
          text: quote,
          citations: [{ documentId: 'news_fixture', quote }],
          companyFeatureIds: [],
          uncertainty: null,
        },
        {
          kind: 'ai_inference' as const,
          text: 'Если нужны новые гарантии, стоит уточнить их стоимость.',
          citations: [],
          companyFeatureIds: ['guarantees'],
          uncertainty: 'Условия гарантий неизвестны.',
        },
      ],
    }
    expect(
      gateDraft(draft, ctx, ['guarantees'], 'Ответ без цитаты').claims.map((claim) => claim.kind),
    ).toEqual(['ai_inference'])
    expect(gateDraft(draft, ctx, ['guarantees'], quote).claims).toHaveLength(2)
  })
  it('drops invented facts, news mislabeled as bank opinion, and unsupported features', async () => {
    const ctx = await createData(loadConfig({ NODE_ENV: 'test' })),
      quote = ctx.news[0]!.text
    const draft = {
      claims: [
        {
          kind: 'fact' as const,
          text: quote,
          citations: [{ documentId: 'news_fixture', quote }],
          companyFeatureIds: [],
          uncertainty: null,
        },
        {
          kind: 'fact' as const,
          text: 'Ставка упала на 50%',
          citations: [{ documentId: 'news_fixture', quote }],
          companyFeatureIds: [],
          uncertainty: null,
        },
        {
          kind: 'bank_position' as const,
          text: quote,
          citations: [{ documentId: 'news_fixture', quote }],
          companyFeatureIds: [],
          uncertainty: null,
        },
        {
          kind: 'ai_inference' as const,
          text: 'Валюта долга USD',
          citations: [],
          companyFeatureIds: ['invented'],
          uncertainty: 'Возможно',
        },
      ],
    }
    const result = gateDraft(draft, ctx, ['loans'])
    expect(result.claims).toHaveLength(1)
    expect(result.claims[0]!.text).toBe(quote)
    expect(result.evidence).toHaveLength(1)
    expect(result.limitations).toHaveLength(3)
  })
})
