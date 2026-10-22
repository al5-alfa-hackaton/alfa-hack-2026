import { afterEach, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'
import { LangGraphRuntime } from '../src/modules/analytics/infrastructure/agent-runtime.js'
import type { AnalyticsStore, Run } from '../src/modules/analytics/index.js'
const servers: Server[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections()
    await new Promise<void>((resolve) => s.close(() => resolve()))
  }
})
it('executes the actual LangGraph/OpenAI adapter with scoped tools and validates the final draft offline', async () => {
  const data = await createData(loadConfig({ NODE_ENV: 'test' })),
    catalog = new ResearchCatalog(data, 'fixture')
  const quote = data.news[0]!.text,
    requests: Record<string, unknown>[] = [],
    progress: string[] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    requests.push(JSON.parse(Buffer.concat(chunks).toString()))
    const n = requests.length
    const message =
      n === 1
        ? {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call-profile',
                type: 'function',
                function: { name: 'company_profile', arguments: '{}' },
              },
            ],
          }
        : {
            role: 'assistant',
            content:
              n === 2
                ? 'Исследование завершено.'
                : JSON.stringify({
                    claims: [
                      {
                        kind: 'fact',
                        text: quote,
                        companyFeatureIds: [],
                        uncertainty: null,
                        citations: [{ documentId: 'news_fixture', quote }],
                      },
                    ],
                  }),
          }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        id: `completion-${n}`,
        object: 'chat.completion',
        created: 1,
        model: 'deepseek/deepseek-v4.1-flash',
        choices: [{ index: 0, message, finish_reason: n === 1 ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      }),
    )
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Address missing')
  const config = loadConfig({
    NODE_ENV: 'test',
    AGENT_PROVIDER: 'langgraph',
    DATA_DIR: '/tmp/not-used',
    LLM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    LLM_API_KEY: 'offline-test-only',
    LLM_GATEWAY_REQUEST_CAP_RUB: '1',
    AGENT_MAX_STEPS: '2',
  })
  const runtime = new LangGraphRuntime(config, catalog, data, {} as AnalyticsStore)
  const id = randomUUID(),
    run: Run = {
      id,
      userId: 'test',
      companyId: 'U_1',
      perspective: 'cfo',
      input: { companyId: 'U_1', perspective: 'cfo', kind: 'refresh_feed' },
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resultIds: [],
      error: null,
      sequence: 1,
      dataMode: 'research',
    }
  const result = await runtime.execute(run, new AbortController().signal, async (type) => {
    progress.push(type)
  })
  expect(requests).toHaveLength(3)
  expect(progress).toContain('tool.completed')
  expect(JSON.stringify(requests[1])).toContain('U_1')
  expect(result.insights[0]!.claims[0]!.text).toBe(quote)
  expect(result.insights[0]!.bankPosition.status).toBe('missing')
  expect(result.insights[0]!.usage).toEqual({
    inputTokens: 300,
    outputTokens: 60,
    cost: null,
    currency: null,
    certainty: 'unknown',
  })
  expect(result.insights[0]!.status).toBe('partial')
})
