import { ExecutionError } from './checkpoint-runtime.js'

export function agentErrorCode(error: unknown): string {
  if (error instanceof ExecutionError) return error.code
  if (error instanceof Error && ['scope_revoked', 'run_timeout'].includes(error.message))
    return error.message
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const details = current as { name?: string; code?: string; status?: number; cause?: unknown }
    if (details.status === 401 || details.status === 403) return 'llm_auth_failed'
    if (details.status === 429) return 'llm_rate_limited'
    if (
      (details.status && details.status >= 500) ||
      ['TimeoutError', 'APIConnectionTimeoutError', 'APIConnectionError'].includes(
        details.name ?? '',
      ) ||
      ['UND_ERR_CONNECT_TIMEOUT', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(
        details.code ?? '',
      )
    )
      return 'llm_unavailable'
    current = details.cause
  }
  return 'agent_failed'
}
