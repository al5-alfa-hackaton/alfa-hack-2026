import test from 'node:test'
import assert from 'node:assert/strict'
import { featureValue } from '../src/entities/company/model.ts'
import { ApiError, createApiClient, unwrap } from '../../../packages/api-client/src/index.ts'

test('unknown profile fields stay unknown and flags are readable', () => {
  assert.equal(featureValue(null), 'Нет данных')
  assert.equal(featureValue('true'), 'Да')
  assert.equal(featureValue('false'), 'Нет')
  assert.equal(featureValue('1000'), '1000')
})
test('typed browser client sends cookies and versioned payloads without embedding access keys', async () => {
  const requests: Request[] = []
  const client = createApiClient({
    baseUrl: 'http://localhost/api',
    fetch: async (input) => {
      const request = input as Request
      requests.push(request)
      return new Response(
        JSON.stringify({
          savedAt: null,
          feedback: { rating: 'useful', comment: 'Проверить источник' },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    },
  })
  const result = unwrap(
    await client.PUT('/v1/insights/{id}/feedback', {
      params: { path: { id: 'insight-id' } },
      body: {
        perspective: 'ceo',
        version: 'version-1',
        rating: 'useful',
        comment: 'Проверить источник',
      },
    }),
  )
  assert.equal(requests[0]?.credentials, 'same-origin')
  assert.equal(requests[0]?.headers.get('Authorization'), null)
  assert.equal(requests[0]?.url, 'http://localhost/api/v1/insights/insight-id/feedback')
  assert.equal((await requests[0]!.json()).perspective, 'ceo')
  assert.equal(result.feedback.comment, 'Проверить источник')
})
test('API errors preserve actionable server messages and request identifiers', () => {
  assert.throws(
    () =>
      unwrap({
        error: { code: 'budget_exhausted', message: 'Дневной лимит исчерпан', requestId: 'req-1' },
        response: new Response('', { status: 429 }),
      }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 429 &&
      error.requestId === 'req-1' &&
      error.message === 'Дневной лимит исчерпан',
  )
})
test('empty 204 response is a successful mutation', () => {
  assert.equal(unwrap({ response: new Response(null, { status: 204 }) }), undefined)
})
