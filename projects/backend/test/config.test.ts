import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const gateway = {
  AGENT_PROVIDER: 'langgraph',
  LLM_BASE_URL: 'https://example.com/v1',
  LLM_API_KEY: 'test-key',
}

describe('digest event limit', () => {
  it('defaults to ten events and allows up to twenty', () => {
    expect(loadConfig({}).RANKING_LIMIT).toBe(10)
    expect(loadConfig({ RANKING_LIMIT: '20' }).RANKING_LIMIT).toBe(20)
    expect(() => loadConfig({ RANKING_LIMIT: '21' })).toThrow()
    expect(() => loadConfig({ RANKING_LIMIT: '0' })).toThrow()
  })
})

describe('local uncapped LLM mode', () => {
  it('requires the gateway cap by default', () => {
    expect(() => loadConfig(gateway)).toThrow('Confirm the gateway hard request cap')
  })
  it('allows an explicit development override without inventing a cap', () => {
    const config = loadConfig({ ...gateway, ALLOW_UNCAPPED_LLM: 'true' })
    expect(config.ALLOW_UNCAPPED_LLM).toBe(true)
    expect(config.LLM_GATEWAY_REQUEST_CAP_RUB).toBeUndefined()
  })
  it('still requires gateway credentials', () => {
    expect(() => loadConfig({ AGENT_PROVIDER: 'langgraph', ALLOW_UNCAPPED_LLM: 'true' })).toThrow(
      'LangGraph requires',
    )
  })
  it('rejects the override outside development', () => {
    for (const mode of ['test', 'production']) {
      expect(() =>
        loadConfig({
          ...gateway,
          NODE_ENV: mode,
          ALLOW_UNCAPPED_LLM: 'true',
          AUTH_USERS_JSON: JSON.stringify([
            { id: 'local', token: 'a'.repeat(40), companyIds: ['U_1'] },
          ]),
        }),
      ).toThrow('only permitted in development')
    }
  })
})
