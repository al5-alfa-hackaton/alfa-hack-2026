import test from 'node:test'
import assert from 'node:assert/strict'
import { runErrorMessage } from '../src/entities/analysis/errors.ts'

test('analysis errors explain gateway problems without exposing raw codes', () => {
  assert.match(runErrorMessage('llm_unavailable'), /LLM-шлюз/)
  assert.match(runErrorMessage('llm_auth_failed'), /API-ключ/)
  assert.match(runErrorMessage('agent_failed'), /Сервис анализа/)
  assert.match(runErrorMessage('execution_context_changed'), /заново/)
  assert.doesNotMatch(runErrorMessage('secret-provider-error'), /secret-provider-error/)
  assert.ok(runErrorMessage(null))
})
