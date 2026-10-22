import { describe, expect, it } from 'vitest'
import { agentErrorCode } from '../src/modules/analytics/infrastructure/agent-error.js'
import { ExecutionError } from '../src/modules/analytics/infrastructure/checkpoint-runtime.js'

describe('safe agent failure codes', () => {
  it('preserves execution and timeout codes', () => {
    expect(agentErrorCode(new ExecutionError('model_call_uncertain'))).toBe('model_call_uncertain')
    expect(agentErrorCode(new Error('run_timeout'))).toBe('run_timeout')
    expect(agentErrorCode(new Error('scope_revoked'))).toBe('scope_revoked')
  })
  it('classifies unavailable gateways including nested connection errors', () => {
    expect(agentErrorCode({ name: 'TimeoutError' })).toBe('llm_unavailable')
    expect(
      agentErrorCode(new Error('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })),
    ).toBe('llm_unavailable')
    expect(agentErrorCode({ status: 503 })).toBe('llm_unavailable')
  })
  it('does not expose provider messages or credentials', () => {
    expect(agentErrorCode({ status: 401, message: 'secret-key' })).toBe('llm_auth_failed')
    expect(agentErrorCode({ status: 403 })).toBe('llm_auth_failed')
    expect(agentErrorCode({ status: 429 })).toBe('llm_rate_limited')
    expect(agentErrorCode(new Error('secret-key'))).toBe('agent_failed')
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(agentErrorCode(cyclic)).toBe('agent_failed')
  })
})
