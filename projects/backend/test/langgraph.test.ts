import { afterEach, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'
import { LangGraphRuntime } from '../src/modules/analytics/infrastructure/agent-runtime.js'
import { rankNews } from '../src/modules/analytics/domain/ranking.js'
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
                ? `Исследование завершено. Факт: «${quote}» [news_fixture]`
                : JSON.stringify({
                    events: [
                      {
                        eventId: 'news_fixture',
                        claims: [
                          {
                            kind: 'fact',
                            text: quote,
                            companyFeatureIds: [],
                            uncertainty: null,
                            citations: [{ documentId: 'news_fixture', quote }],
                          },
                        ],
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
it.each([0, 6])(
  'publishes multiple events with %i extra events and rejects mismatched claims',
  async (extraCount) => {
    const data = await createData(loadConfig({ NODE_ENV: 'test' })),
      catalog = new ResearchCatalog(data, 'fixture')
    const news = data.news.find((n) => n.id === 'news_fixture')!,
      steel = data.news.find((n) => n.id === 'news_fixture_steel')!
    const coal = data.news.find((event) => event.id === 'news_fixture_coal')!
    const extraNews = Array.from({ length: extraCount }, (_, index) => ({
      ...news,
      id: `news_extra_${index}`,
    }))
    data.news.push(...extraNews)
    const claim = (n: typeof news) => ({
      kind: 'fact',
      text: n.text,
      companyFeatureIds: [],
      uncertainty: null,
      citations: [{ documentId: n.id, quote: n.text }],
    })
    let requests = 0
    const server = createServer(async (req, res) => {
      for await (const _ of req) {
      }
      requests++
      const content =
        requests === 1
          ? [
              ...[news, steel, ...extraNews].map(
                (event) => `Событие ${event.id}\nФакт: «${event.text}» [${event.id}]`,
              ),
              `Событие ${coal.id}: пропустить — недостаточная связь. «${coal.text}»`,
            ].join('\n')
          : JSON.stringify({
              events: [
                { eventId: steel.id, claims: [claim(steel)] },
                {
                  eventId: news.id,
                  summary: 'Главное: стоимость финансирования может измениться.',
                  kind: 'risk',
                  risks: ['Процентные расходы могут вырасти.'],
                  opportunities: [],
                  actions: ['Проверить условия кредитования.'],
                  claims: [
                    claim(news),
                    {
                      ...claim(news),
                      citations: [{ documentId: news.id, quote: 'x'.repeat(301) }],
                    },
                  ],
                },
                { eventId: coal.id, claims: [claim(coal)] },
                ...extraNews.map((event) => ({ eventId: event.id, claims: [claim(event)] })),
                { eventId: 'news_fixture_retail', claims: [claim(news)] },
              ],
            })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          id: `batch-${requests}`,
          object: 'chat.completion',
          created: 1,
          model: 'deepseek/deepseek-v4.1-flash',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      )
    })
    servers.push(server)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing address')
    const config = loadConfig({
      NODE_ENV: 'test',
      AGENT_PROVIDER: 'langgraph',
      DATA_DIR: '/tmp/not-used',
      LLM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
      LLM_API_KEY: 'offline-only',
      LLM_GATEWAY_REQUEST_CAP_RUB: '1',
    })
    const id = randomUUID(),
      run: Run = {
        id,
        userId: 'test',
        companyId: 'U_1',
        perspective: 'cfo',
        input: { companyId: 'U_1', perspective: 'cfo', kind: 'refresh_feed' },
        status: 'running',
        createdAt: '2026-10-22T12:00:00.000Z',
        updatedAt: new Date().toISOString(),
        resultIds: [],
        error: null,
        sequence: 1,
        dataMode: 'research',
      }
    const result = await new LangGraphRuntime(config, catalog, data, {} as AnalyticsStore).execute(
      run,
      new AbortController().signal,
      async () => {},
    )
    const expectedIds = new Set([news.id, steel.id, ...extraNews.map((event) => event.id)])
    const expected = rankNews(
      data.news,
      catalog.context('U_1').features,
      'cfo',
      run.createdAt,
    ).filter((event) => expectedIds.has(event.news.id))
    expect(result.insights.map((i) => i.event.id)).toEqual(expected.map((event) => event.news.id))
    expect(result.insights).toHaveLength(2 + extraCount)
    expect(result.insights.map((i) => i.relevance.rank)).toEqual(
      expected.map((_, index) => index + 1),
    )
    expect(result.insights[0]!.relevance.score).toBeGreaterThan(
      result.insights.at(-1)!.relevance.score,
    )
    expect(result.insights.every((i) => i.evidence.some((e) => e.documentId === i.event.id))).toBe(
      true,
    )
    expect(requests).toBe(2)
    const finance = result.insights.find((insight) => insight.event.id === news.id)!
    expect(finance.summary).toBe('Главное: стоимость финансирования может измениться.')
    expect(finance.kind).toBe('risk')
    expect(finance.risks).toEqual(['Процентные расходы могут вырасти.'])
    expect(finance.actions).toEqual(['Проверить условия кредитования.'])
    expect(finance.limitations).toContain(
      'Отдельные утверждения исключены из-за неверного формата.',
    )
  },
)

it('returns the direct answer instead of repeating the digest in question mode', async () => {
  const data = await createData(loadConfig({ NODE_ENV: 'test' }))
  const catalog = new ResearchCatalog(data, 'fixture')
  const news = data.news[0]!
  const answer = 'Если ставка плавающая, проверьте дату её следующего пересмотра.'
  let requests = 0
  const server = createServer(async (req, res) => {
    for await (const chunk of req) {
      void chunk
    }
    requests++
    const content =
      requests === 1
        ? `Событие ${news.id}\nОтвет: ${answer}\nФакт: «${news.text}» [${news.id}]`
        : JSON.stringify({
            events: [
              {
                eventId: news.id,
                summary: 'Это сводка, а не ответ.',
                answer,
                claims: [
                  {
                    kind: 'fact',
                    text: news.text,
                    companyFeatureIds: [],
                    uncertainty: null,
                    citations: [{ documentId: news.id, quote: news.text }],
                  },
                ],
              },
            ],
          })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        id: `question-${requests}`,
        object: 'chat.completion',
        created: 1,
        model: 'deepseek/deepseek-v4.1-flash',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      }),
    )
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing address')
  const config = loadConfig({
    NODE_ENV: 'test',
    AGENT_PROVIDER: 'langgraph',
    LLM_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
    LLM_API_KEY: 'offline-only',
    LLM_GATEWAY_REQUEST_CAP_RUB: '1',
  })
  const createdAt = '2026-10-22T12:00:00.000Z'
  const prior = {
    event: { id: news.id },
    relevance: rankNews(data.news, catalog.context('U_1').features, 'cfo', createdAt)[0]!.relevance,
    version: 'prior',
    summary: 'Предыдущая сводка',
    evidence: [],
  }
  const store = {
    insight: async () => prior,
    messages: async () => [],
  } as unknown as AnalyticsStore
  const run: Run = {
    id: randomUUID(),
    userId: 'test',
    companyId: 'U_1',
    perspective: 'cfo',
    input: {
      companyId: 'U_1',
      perspective: 'cfo',
      kind: 'question',
      question: 'Что проверить по кредиту?',
      insightId: randomUUID(),
    },
    status: 'running',
    createdAt,
    updatedAt: createdAt,
    resultIds: [],
    error: null,
    sequence: 1,
    dataMode: 'research',
  }
  const result = await new LangGraphRuntime(config, catalog, data, store).execute(
    run,
    new AbortController().signal,
    async () => {},
  )
  expect(result).toEqual({ insights: [], answer })
  expect(requests).toBe(2)
})
