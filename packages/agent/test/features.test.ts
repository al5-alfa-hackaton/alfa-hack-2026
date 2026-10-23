import { describe, expect, it } from 'vitest'
import { AGENT_SYSTEM_PROMPT } from '../src/agent/prompts.js'
import { parseFeedAnswer } from '../src/agent/feed-parser.js'
import { FEATURE_IDS, FEATURE_LABELS } from '../src/features.js'
import { companyExposures } from '../src/news/ranking.js'
import { fixtureContext } from './helpers.js'

const ctx = await fixtureContext()

describe('shared feature list', () => {
  it('labels every feature and lists all of them in the prompt', () => {
    expect(Object.keys(FEATURE_LABELS).sort()).toEqual([...FEATURE_IDS].sort())
    for (const id of FEATURE_IDS) expect(AGENT_SYSTEM_PROMPT).toContain(id)
  })

  it('uses only known features in ranking explanations', () => {
    for (const id of ['U_1', 'U_3'])
      for (const e of companyExposures(ctx, id)) expect(FEATURE_IDS).toContain(e.featureId)
  })

  it('drops features outside the shared list when the backend list is not given', () => {
    const result = parseFeedAnswer('Событие news_rate\nГлавное: Ставка высокая. Признаки: loans, made_up. Оговорка: тип ставки неизвестен.', {})
    expect(result.events[0]!.claims[0]!.companyFeatureIds).toEqual(['loans'])
    expect(result.issues).toContain('news_rate: признаки made_up неизвестны и убраны')
  })
})
