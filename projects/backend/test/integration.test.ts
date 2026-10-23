import { seedDatasetAccounts } from '../src/modules/identity/infrastructure/seed-dataset.js'
import { createServer } from 'node:http'
import { LangGraphRuntime } from '../src/modules/analytics/infrastructure/agent-runtime.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'
import { buildAgentGraph } from '@alfa/agent'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { ScriptedModel, toolCall } from './scripted-model.js'
import { createData } from '../src/composition/data.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { and, eq, sql } from 'drizzle-orm'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import {
  CheckpointRuntime,
  ExecutionError,
  setupCheckpoints,
} from '../src/modules/analytics/infrastructure/checkpoint-runtime.js'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { compose, type Runtime } from '../src/composition/runtime.js'
import * as t from '../src/infrastructure/database/schema.js'
const enabled = process.env.RUN_INTEGRATION === 'true'
const alice = 'a'.repeat(40),
  bob = 'b'.repeat(40)
const headers = { authorization: `Bearer ${alice}` }
const id = randomUUID().replaceAll('-', ''),
  dbName = `alfa_test_${id}`,
  queuePrefix = `test-${id}`
let admin: pg.Pool,
  runtime: Runtime,
  app: Awaited<ReturnType<typeof buildApp>>,
  worker: ChildProcess,
  redis: Redis,
  queue: Queue
let integrationConfig: ReturnType<typeof loadConfig>
let workerError = ''
async function waitRun(runId: string) {
  for (let n = 0; n < 100; n++) {
    const r = await app.inject({ url: `/v1/analysis-runs/${runId}`, headers })
    expect(r.statusCode).toBe(200)
    const run = r.json()
    if (['partial', 'completed', 'failed', 'cancelled'].includes(run.status)) return run
    await delay(100)
  }
  throw new Error(`Worker did not finish: ${workerError}`)
}
async function start(key: string, companyId = 'U_1') {
  return app.inject({
    method: 'POST',
    url: '/v1/analysis-runs',
    headers: { ...headers, 'idempotency-key': key },
    payload: { companyId, perspective: 'cfo', kind: 'refresh_feed' },
  })
}
describe.skipIf(!enabled)('PostgreSQL + Redis + actual worker', () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error('Set TEST_DATABASE_URL to a local database with CREATE DATABASE permission')
    const url = new URL(process.env.TEST_DATABASE_URL)
    if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname))
      throw new Error('Integration DB must be local')
    admin = new pg.Pool({ connectionString: url.toString() })
    await admin.query(`create database ${dbName}`)
    url.pathname = `/${dbName}`
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: url.toString(),
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379',
      QUEUE_PREFIX: queuePrefix,
      DEV_AUTH: 'false',
      AGENT_PROVIDER: 'fixture',
      AUTH_SESSION_SECRET: 'integration-session-secret-'.repeat(3),
      AUTH_USERS_JSON: JSON.stringify([
        { id: 'alice', token: alice, companyIds: ['U_1'] },
        { id: 'bob', token: bob, companyIds: ['U_3'] },
      ]),
    }
    const config = loadConfig(env)
    integrationConfig = config
    runtime = await compose(config)
    await migrate(runtime.database!.db, { migrationsFolder: 'drizzle' })
    await setupCheckpoints(runtime.database!.pool)
    app = await buildApp(config, runtime)
    await app.ready()
    redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })
    queue = new Queue('analysis-runs', { connection: redis, prefix: queuePrefix })
    worker = spawn(process.execPath, ['--import', 'tsx', 'src/worker.ts'], {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    worker.stderr?.on('data', (data) => {
      workerError += String(data)
    })
    await Promise.race([
      new Promise<void>((resolve) => {
        worker.stdout?.on('data', (data) => {
          if (String(data).includes('ready')) resolve()
        })
      }),
      delay(10000).then(() => {
        throw new Error('Worker startup timeout')
      }),
    ])
  }, 20000)
  afterAll(async () => {
    if (worker && worker.exitCode === null) {
      const exit = once(worker, 'exit')
      worker.kill('SIGTERM')
      await exit
    }
    await app?.close()
    await queue?.obliterate({ force: true })
    await queue?.close()
    redis?.disconnect()
    await runtime?.database?.pool.end()
    if (admin) {
      for (let n = 0; n < 100; n++) {
        const active = await admin.query(
          'select count(*)::int as count from pg_stat_activity where datname=$1',
          [dbName],
        )
        if (active.rows[0].count === 0) break
        await delay(20)
      }
      await admin.query(`drop database if exists ${dbName}`)
      await admin.end()
    }
  })
  it('deduplicates concurrent HTTP requests transactionally and rejects conflicting keys', async () => {
    const key = randomUUID(),
      responses = await Promise.all(Array.from({ length: 8 }, () => start(key)))
    expect(responses.every((r) => r.statusCode === 202)).toBe(true)
    const ids = new Set(responses.map((r) => r.json().runId))
    expect(ids.size).toBe(1)
    const conflict = await app.inject({
      method: 'POST',
      url: '/v1/analysis-runs',
      headers: { ...headers, 'idempotency-key': key },
      payload: { companyId: 'U_1', perspective: 'ceo', kind: 'refresh_feed' },
    })
    expect(conflict.statusCode).toBe(409)
    const id = [...ids][0] as string
    const run = await waitRun(id)
    expect(run.status).toBe('partial')
    expect(run.resultIds.length).toBeGreaterThan(0)
    expect(
      await runtime.database!.db.select().from(t.outbox).where(eq(t.outbox.runId, id)),
    ).toHaveLength(1)
  })
  it('publishes a scoped feed, safe documents, and replayable SSE', async () => {
    const accepted = (await start(randomUUID())).json(),
      run = await waitRun(accepted.runId)
    const feed = await app.inject({ url: '/v1/companies/U_1/insights?perspective=cfo', headers })
    expect(feed.statusCode).toBe(200)
    const i = feed.json().items[0]
    expect(i.runId).toBe(run.id)
    expect(i.dataMode).toBe('fixture')
    expect(i.evidence[0].verified).toBe(true)
    const doc = await app.inject({
      url: `/v1/documents/${i.evidence[0].documentId}?length=20`,
      headers,
    })
    expect(doc.statusCode).toBe(200)
    expect(doc.json().text).toHaveLength(20)
    expect(doc.body).not.toContain('/workspace')
    const sse = await app.inject({ url: `/v1/analysis-runs/${run.id}/events`, headers })
    expect(sse.headers['content-type']).toContain('text/event-stream')
    expect(sse.body).toContain('event: run.partial')
    const replay = await app.inject({
      url: `/v1/analysis-runs/${run.id}/events`,
      headers: { ...headers, 'last-event-id': `${run.id}:1` },
    })
    expect(replay.body).not.toContain('event: run.queued')
    expect(replay.body).not.toContain('args')
    expect(
      (
        await app.inject({
          url: `/v1/analysis-runs/${run.id}/events`,
          headers: { ...headers, 'last-event-id': 'wrong:1' },
        })
      ).statusCode,
    ).toBe(400)
  })
  it('enforces user and company scope on runs, insights and documents', async () => {
    const run = await waitRun((await start(randomUUID())).json().runId),
      i = run.resultIds[0]
    const other = { authorization: `Bearer ${bob}` }
    for (const url of [
      `/v1/analysis-runs/${run.id}`,
      `/v1/insights/${i}?perspective=cfo`,
      '/v1/documents/news_fixture',
      '/v1/companies/U_1/context',
    ])
      expect((await app.inject({ url, headers: other })).statusCode).toBe(404)
    expect((await start(randomUUID(), 'U_3')).statusCode).toBe(404)
  })
  it('persists bookmarks, independent feedback, and a deduplicated asynchronous conversation', async () => {
    const run = await waitRun((await start(randomUUID())).json().runId),
      insight = await runtime.store.insight(
        { id: 'alice', companyIds: ['U_1'] },
        run.resultIds[0],
        'cfo',
      )
    const scope = { perspective: 'cfo', version: insight.version }
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/v1/me/saved-insights/${insight.id}`,
          headers,
          payload: scope,
        })
      ).statusCode,
    ).toBe(200)
    const feedback = await app.inject({
      method: 'PUT',
      url: `/v1/insights/${insight.id}/feedback`,
      headers,
      payload: { ...scope, rating: null, comment: 'Нужны условия кредита' },
    })
    expect(feedback.json().feedback.comment).toBe('Нужны условия кредита')
    const key = randomUUID(),
      ask = () =>
        app.inject({
          method: 'POST',
          url: `/v1/insights/${insight.id}/questions`,
          headers: { ...headers, 'idempotency-key': key },
          payload: {
            perspective: 'cfo',
            insightVersion: insight.version,
            question: 'Как оценить риск?',
          },
        })
    const responses = await Promise.all([ask(), ask()])
    expect(responses[0]!.json().runId).toBe(responses[1]!.json().runId)
    await waitRun(responses[0]!.json().runId)
    const conversation = await app.inject({
      url: `/v1/insights/${insight.id}/conversation?perspective=cfo`,
      headers,
    })
    expect(conversation.json().items.map((m: { author: string }) => m.author)).toEqual([
      'user',
      'assistant',
    ])
    // A later refresh retains saved historical versions.
    await waitRun((await start(randomUUID())).json().runId)
    const saved = await app.inject({
      url: '/v1/companies/U_1/saved-insights?perspective=cfo',
      headers,
    })
    expect(saved.json().items.some((i: { id: string }) => i.id === insight.id)).toBe(true)
    const reopened = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }), runtime)
    expect(
      (await runtime.store.userState({ id: 'alice', companyIds: ['U_1'] }, insight)).feedback
        .comment,
    ).toBe('Нужны условия кредита')
    await reopened.close()
  })
  it('cancels queued runs without publishing a new snapshot', async () => {
    // Insert and cancel within one dispatcher interval; store transition is atomic with its event.
    const p = { id: 'alice', companyIds: ['U_1'] }
    const before = await runtime.store.insights('U_1', 'cfo')
    const run = await runtime.analytics.start(
      p,
      { companyId: 'U_1', perspective: 'cfo', kind: 'refresh_feed' },
      randomUUID(),
    )
    const cancelled = await runtime.store.cancel(p, run.id)
    expect(['cancelled', 'cancelling']).toContain(cancelled.status)
    const terminal = await waitRun(run.id)
    expect(terminal.status).toBe('cancelled')
    expect((await runtime.store.insights('U_1', 'cfo'))[0]?.id).toBe(before[0]?.id)
  })
  it('reserves the global budget atomically across competing runs', async () => {
    const p = { id: 'alice', companyIds: ['U_1'] },
      input = { companyId: 'U_1', perspective: 'cfo' as const, kind: 'refresh_feed' as const }
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        runtime.store.createRun(p, input, randomUUID(), randomUUID(), 300, 500, 'fixture'),
      ),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(2)
    const success = results.find((r) => r.status === 'fulfilled')
    if (success?.status === 'fulfilled') await runtime.store.cancel(p, success.value.id)
  })
  it('closes expired leases without repeating model calls and releases reservations safely', async () => {
    const p = { id: 'alice', companyIds: ['U_1'] },
      input = { companyId: 'U_1', perspective: 'ceo' as const, kind: 'refresh_feed' as const }
    const run = await runtime.store.createRun(
      p,
      input,
      randomUUID(),
      randomUUID(),
      1,
      500,
      'fixture',
    )
    expect(await runtime.store.claim(run.id)).not.toBeNull()
    expect(await runtime.store.claim(run.id)).toBeNull()
    await runtime
      .database!.db.update(t.runs)
      .set({ leaseUntil: new Date(Date.now() - 1000) })
      .where(eq(t.runs.id, run.id))
    await runtime.store.recoverExpired()
    const failed = await runtime.store.run(p, run.id)
    expect(failed.status).toBe('queued')
    const resumed = await waitRun(run.id)
    expect(resumed.status).toBe('partial')
    const [budget] = await runtime.database!.db.select().from(t.budgets)
    expect(budget!.reserved).toBe(0)
    expect(budget!.spent).toBeGreaterThanOrEqual(1)
  })
  it('persists graph steps/tools/finalization in PostgreSQL and resumes with a new lease', async () => {
    await queue.pause()
    try {
      const p = { id: 'alice', companyIds: ['U_1'] }
      const input = { companyId: 'U_1', perspective: 'cfo' as const, kind: 'refresh_feed' as const }
      const run = await runtime.store.createRun(
        p,
        input,
        randomUUID(),
        randomUUID(),
        0,
        500,
        'fixture',
      )
      const claimed = (await runtime.store.claim(run.id))!
      const persistence = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        claimed,
        claimed.leaseToken,
      )
      await persistence.bindScope('checkpoint-test-v1')
      const ctx = await createData(loadConfig({ NODE_ENV: 'test' })),
        audit: import('@alfa/agent').ToolCallRecord[] = []
      const firstModel = new ScriptedModel([toolCall()])
      const scope = {
        configurable: { thread_id: run.id, companyId: run.companyId },
        durability: 'sync' as const,
      }
      const graph = buildAgentGraph({
        ctx,
        model: firstModel,
        limits: { maxSteps: 4, maxToolCalls: 6 },
        checkpointer: persistence.checkpointer,
        invokeModel: (...args) => persistence.call(...args),
        interruptAfter: ['tools'],
        audit,
      })
      await graph.invoke(
        { messages: [new HumanMessage('Проверь компанию')], executionScope: 'checkpoint-test-v1' },
        scope,
      )
      const snapshot = await graph.getState(scope)
      expect(snapshot.next).toContain('agent')
      expect(snapshot.values.steps).toBe(1)
      expect(audit).toHaveLength(1)
      await runtime
        .database!.db.update(t.runs)
        .set({ leaseUntil: new Date(Date.now() - 1000) })
        .where(eq(t.runs.id, run.id))
      await runtime.store.recoverExpired()
      const next = (await runtime.store.claim(run.id, 1))!
      expect(next.leaseToken).not.toBe(claimed.leaseToken)
      await expect(
        persistence.checkpointer.putWrites(snapshot.config, [['steps', 999]], 'stale'),
      ).rejects.toThrow('lease_lost')
      await runtime.store.finish(run.id, { insights: [] }, undefined, claimed.leaseToken)
      expect((await runtime.store.run(p, run.id)).status).toBe('running')
      const resumedPersistence = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        next,
        next.leaseToken,
      )
      await resumedPersistence.bindScope('checkpoint-test-v1')
      await expect(resumedPersistence.bindScope('different-company-or-corpus')).rejects.toThrow(
        'execution_context_changed',
      )
      const secondModel = new ScriptedModel([new AIMessage('Готовый анализ')])
      let finalized = 0
      const resumed = buildAgentGraph({
        ctx,
        model: secondModel,
        limits: { maxSteps: 4, maxToolCalls: 6 },
        checkpointer: resumedPersistence.checkpointer,
        invokeModel: (...args) => resumedPersistence.call(...args),
        finalize: async () => {
          finalized++
          return new AIMessage('{"events":[]}')
        },
        audit,
      })
      const result = await resumed.invoke(null, scope)
      expect(result.steps).toBe(2)
      expect(result.stopReason).toBe('answered')
      expect(result.structured?.content).toBe('{"events":[]}')
      expect(audit).toHaveLength(1)
      expect(firstModel.calls).toBe(1)
      expect(secondModel.calls).toBe(1)
      expect(finalized).toBe(1)
      const reopened = buildAgentGraph({
        ctx,
        model: new ScriptedModel([]),
        limits: { maxSteps: 4, maxToolCalls: 6 },
        checkpointer: new CheckpointRuntime(runtime.database!.pool, 8).forRun(next, next.leaseToken)
          .checkpointer,
        finalize: async () => {
          throw new Error('Finalization replayed')
        },
      })
      expect((await reopened.invoke(null, scope)).structured?.content).toBe('{"events":[]}')
      await runtime.store.finish(run.id, { insights: [] }, undefined, next.leaseToken)
    } finally {
      await queue.resume()
    }
  })
  it('reuses a durable model response when the worker fails before the next node checkpoint', async () => {
    await queue.pause()
    try {
      const p = { id: 'alice', companyIds: ['U_1'] },
        input = { companyId: 'U_1', perspective: 'cfo' as const, kind: 'refresh_feed' as const }
      const run = await runtime.store.createRun(
          p,
          input,
          randomUUID(),
          randomUUID(),
          0,
          500,
          'fixture',
        ),
        first = (await runtime.store.claim(run.id))!
      const durable = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        first,
        first.leaseToken,
      )
      await durable.bindScope('response-cache-test')
      const ctx = await createData(loadConfig({ NODE_ENV: 'test' })),
        firstModel = new ScriptedModel([toolCall()])
      const scope = {
        configurable: { thread_id: run.id, companyId: run.companyId },
        durability: 'sync' as const,
      }
      const initial = buildAgentGraph({
        ctx,
        model: firstModel,
        limits: { maxSteps: 4, maxToolCalls: 6 },
        checkpointer: durable.checkpointer,
        invokeModel: async (...args) => {
          await durable.call(...args)
          throw new Error('simulated-worker-crash-before-checkpoint')
        },
      })
      await expect(
        initial.invoke(
          { messages: [new HumanMessage('Анализ')], executionScope: 'response-cache-test' },
          scope,
        ),
      ).rejects.toThrow('simulated-worker-crash')
      await runtime
        .database!.db.update(t.runs)
        .set({ leaseUntil: new Date(Date.now() - 1000) })
        .where(eq(t.runs.id, run.id))
      await runtime.store.recoverExpired()
      const second = (await runtime.store.claim(run.id, 1))!
      const resumed = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        second,
        second.leaseToken,
      )
      await resumed.bindScope('response-cache-test')
      const model = new ScriptedModel([new AIMessage('Финальный ответ')])
      const graph = buildAgentGraph({
        ctx,
        model,
        limits: { maxSteps: 4, maxToolCalls: 6 },
        checkpointer: resumed.checkpointer,
        invokeModel: (...args) => resumed.call(...args),
      })
      const result = await graph.invoke(null, scope)
      expect(result.steps).toBe(2)
      expect(firstModel.calls + model.calls).toBe(2)
      expect(
        await runtime
          .database!.db.select()
          .from(t.modelCalls)
          .where(eq(t.modelCalls.runId, run.id)),
      ).toHaveLength(2)
      await runtime.store.finish(run.id, { insights: [] }, undefined, second.leaseToken)
    } finally {
      await queue.resume()
    }
  })
  it('fails closed for an ambiguous paid call without releasing its consumed reservation', async () => {
    await queue.pause()
    try {
      const p = { id: 'alice', companyIds: ['U_1'] },
        input = { companyId: 'U_1', perspective: 'ceo' as const, kind: 'refresh_feed' as const }
      const run = await runtime.store.createRun(
          p,
          input,
          randomUUID(),
          randomUUID(),
          1,
          500,
          'fixture',
        ),
        claimed = (await runtime.store.claim(run.id))!
      const durable = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        claimed,
        claimed.leaseToken,
      )
      await durable.bindScope('uncertain-call-test')
      let requests = 0
      await expect(
        durable.call(
          'agent:0',
          async () => {
            requests++
            throw new Error('connection-lost')
          },
          [new HumanMessage('Вопрос')],
        ),
      ).rejects.toThrow('connection-lost')
      await expect(
        durable.call(
          'agent:0',
          async () => {
            requests++
            return new AIMessage('duplicate')
          },
          [new HumanMessage('Вопрос')],
        ),
      ).rejects.toThrow('model_call_uncertain')
      expect(requests).toBe(1)
      await runtime
        .database!.db.update(t.runs)
        .set({ leaseUntil: new Date(Date.now() - 1000) })
        .where(eq(t.runs.id, run.id))
      await runtime.store.recoverExpired()
      const failed = await runtime.store.run(p, run.id)
      expect(failed.status).toBe('failed')
      expect(failed.error).toBe('model_call_uncertain')
    } finally {
      await queue.resume()
    }
  })
  it('restores the complete backend batch after a crash before publication without another provider request', async () => {
    await queue.pause()
    const ctx = await createData(loadConfig({ NODE_ENV: 'test' })),
      news = ctx.news[0]!
    let calls = 0
    const server = createServer(async (req, res) => {
      for await (const _ of req) {
      }
      calls++
      const content =
        calls === 1
          ? `Событие ${news.id}\nФакт: «${news.text}» [${news.id}]`
          : JSON.stringify({
              events: [
                {
                  eventId: news.id,
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
          id: `resume-${calls}`,
          object: 'chat.completion',
          created: 1,
          model: 'deepseek/deepseek-v4.1-flash',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      )
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
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
      const p = { id: 'alice', companyIds: ['U_1'] },
        input = { companyId: 'U_1', perspective: 'cfo' as const, kind: 'refresh_feed' as const }
      const run = await runtime.store.createRun(
          p,
          input,
          randomUUID(),
          randomUUID(),
          1,
          500,
          'research',
        ),
        claimed = (await runtime.store.claim(run.id))!
      const makeRuntime = () =>
        new LangGraphRuntime(
          config,
          new ResearchCatalog(ctx, 'research'),
          ctx,
          runtime.store,
          new CheckpointRuntime(runtime.database!.pool, 8),
        )
      const first = await makeRuntime().execute(
        claimed,
        new AbortController().signal,
        async () => {},
        claimed.leaseToken,
      )
      expect(first.insights).toHaveLength(1)
      expect(calls).toBe(2)
      // Crash after durable finalization, before the SQL publication transaction.
      await runtime
        .database!.db.update(t.runs)
        .set({ leaseUntil: new Date(Date.now() - 1000) })
        .where(eq(t.runs.id, run.id))
      await runtime.store.recoverExpired()
      const lease = (await runtime.store.claim(run.id, 1))!
      const resumed = await makeRuntime().execute(
        lease,
        new AbortController().signal,
        async () => {},
        lease.leaseToken,
      )
      expect(calls).toBe(2)
      expect(resumed.insights[0]!.summary).toBe(first.insights[0]!.summary)
      expect(resumed.insights[0]!.usage).toEqual(first.insights[0]!.usage)
      await runtime.store.finish(run.id, resumed, undefined, lease.leaseToken)
      await runtime.store.finish(run.id, resumed, undefined, lease.leaseToken)
      const published = await runtime.store.run(p, run.id)
      expect(published.status).toBe('partial')
      expect(published.resultIds).toHaveLength(1)
      expect(
        await runtime.database!.db.select().from(t.insights).where(eq(t.insights.runId, run.id)),
      ).toHaveLength(1)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await queue.resume()
    }
  })
  it('charges an already started run when cancellation happens during recovery', async () => {
    await queue.pause()
    try {
      const p = { id: 'alice', companyIds: ['U_1'] },
        input = { companyId: 'U_1', perspective: 'ceo' as const, kind: 'refresh_feed' as const }
      const [before] = await runtime.database!.db.select().from(t.budgets)
      const run = await runtime.store.createRun(
          p,
          input,
          randomUUID(),
          randomUUID(),
          2,
          500,
          'research',
        ),
        claim = (await runtime.store.claim(run.id))!
      const durable = new CheckpointRuntime(runtime.database!.pool, 8).forRun(
        claim,
        claim.leaseToken,
      )
      await durable.call('agent:0', async () => new AIMessage('cached'), [
        new HumanMessage('question'),
      ])
      await runtime
        .database!.db.update(t.runs)
        .set({ leaseUntil: new Date(Date.now() - 1000) })
        .where(eq(t.runs.id, run.id))
      await runtime.store.recoverExpired()
      expect((await runtime.store.run(p, run.id)).status).toBe('queued')
      expect((await runtime.store.cancel(p, run.id)).status).toBe('cancelled')
      const [after] = await runtime.database!.db.select().from(t.budgets)
      expect(after!.spent - before!.spent).toBe(2)
    } finally {
      await queue.resume()
    }
  })
  it('reconciles a lost Redis delivery from the durable SQL outbox', async () => {
    await queue.pause()
    let runId = ''
    try {
      const accepted = (await start(randomUUID())).json()
      runId = accepted.runId
      const jobId = `${runId}-0`
      for (let n = 0; n < 40; n++) {
        if (await queue.getJob(jobId)) break
        await delay(50)
      }
      const original = await queue.getJob(jobId)
      expect(original).toBeDefined()
      await original!.remove()
      await runtime
        .database!.db.update(t.outbox)
        .set({ publishedAt: new Date(Date.now() - 10000) })
        .where(eq(t.outbox.runId, runId))
      for (let n = 0; n < 40; n++) {
        if (await queue.getJob(jobId)) break
        await delay(50)
      }
      expect(await queue.getJob(jobId)).toBeDefined()
    } finally {
      await queue.resume()
    }
    expect((await waitRun(runId)).status).toBe('partial')
  }, 15000)

  it('seeds isolated dataset accounts idempotently and authenticates usernames/passwords', async () => {
    const accounts = [
      { companyId: 'U_1', username: 'client_u_1', password: 'dataset-' + 'a'.repeat(24) },
      { companyId: 'U_3', username: 'client_u_3', password: 'dataset-' + 'b'.repeat(24) },
    ]
    await seedDatasetAccounts(runtime.database!.db, accounts)
    await seedDatasetAccounts(runtime.database!.db, accounts)
    expect(
      await runtime.database!.db.select().from(t.users).where(eq(t.users.source, 'dataset')),
    ).toHaveLength(2)
    const login = await app.inject({
      method: 'POST',
      url: '/v1/session',
      payload: { username: 'CLIENT_U_1', password: accounts[0]!.password },
    })
    expect(login.statusCode).toBe(200)
    expect(login.body).not.toContain('password')
    const cookie = login.cookies[0]!
    const scoped = { cookie: cookie.name + '=' + encodeURIComponent(cookie.value) }
    expect(
      (await app.inject({ url: '/v1/companies', headers: scoped }))
        .json()
        .items.map((c: { id: string }) => c.id),
    ).toEqual(['U_1'])
    expect(
      (await app.inject({ url: '/v1/companies/U_3/context', headers: scoped })).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/session',
          payload: { username: 'client_u_1', password: 'incorrect-password' },
        })
      ).statusCode,
    ).toBe(401)
  })
  it('registers a user and company atomically, hydrates another API process, and runs the actual worker', async () => {
    const body = {
      username: 'owner_' + randomUUID().slice(0, 8),
      password: 'new-company-password-2026',
      company: {
        name: 'Стальная перспектива',
        industry: 'Производство стали',
        region: 'Урал',
        revenue: 25000000000,
        products: { loans: true, guarantees: true },
        customsCountries: ['Китай'],
      },
    }
    const registration = await app.inject({
      method: 'POST',
      url: '/v1/registrations',
      payload: body,
    })
    expect(registration.statusCode).toBe(201)
    const result = registration.json()
    const cookie = registration.cookies[0]!
    const scope = { cookie: cookie.name + '=' + encodeURIComponent(cookie.value) }
    expect(result.companyId).not.toBe('U_1')
    const company = await app.inject({
      url: '/v1/companies/' + result.companyId + '/context',
      headers: scope,
    })
    expect(company.statusCode).toBe(200)
    expect(company.json()).toMatchObject({
      company: { displayName: body.company.name },
      profileSource: 'user',
    })
    expect(company.json().features).toContainEqual({
      id: 'loans',
      label: 'Кредиты в Альфа-Банке',
      value: 'true',
    })
    expect(company.json().limitations.join(' ')).toContain('пользователем')
    expect(
      (await app.inject({ url: '/v1/companies/U_1/context', headers: scope })).statusCode,
    ).toBe(404)
    const otherRuntime = await compose(integrationConfig)
    const otherApp = await buildApp(integrationConfig, otherRuntime)
    try {
      const restored = await otherApp.inject({
        url: '/v1/companies/' + result.companyId + '/context',
        headers: scope,
      })
      expect(restored.statusCode).toBe(200)
      expect(restored.json().company.displayName).toBe(body.company.name)
    } finally {
      await otherApp.close()
      await otherRuntime.database!.pool.end()
    }
    const accepted = await app.inject({
      method: 'POST',
      url: '/v1/analysis-runs',
      headers: { ...scope, 'idempotency-key': randomUUID() },
      payload: { companyId: result.companyId, perspective: 'cfo', kind: 'refresh_feed' },
    })
    expect(accepted.statusCode).toBe(202)
    let status = ''
    for (let n = 0; n < 100; n++) {
      const run = (
        await app.inject({ url: '/v1/analysis-runs/' + accepted.json().runId, headers: scope })
      ).json()
      status = run.status
      if (['partial', 'completed', 'failed', 'cancelled'].includes(status)) break
      await delay(100)
    }
    expect(status).toBe('partial')
    const feed = (
      await app.inject({
        url: '/v1/companies/' + result.companyId + '/insights?perspective=cfo',
        headers: scope,
      })
    ).json()
    expect(feed.items.length).toBeGreaterThan(0)
    expect(feed.items.every((i: { companyId: string }) => i.companyId === result.companyId)).toBe(
      true,
    )
    expect(
      (await app.inject({ url: '/v1/analysis-runs/' + accepted.json().runId, headers })).statusCode,
    ).toBe(404)
    const before = await runtime.database!.db.select().from(t.customCompanies)
    const duplicate = await app.inject({ method: 'POST', url: '/v1/registrations', payload: body })
    expect(duplicate.statusCode).toBe(409)
    expect(await runtime.database!.db.select().from(t.customCompanies)).toHaveLength(before.length)
    const relogin = await app.inject({
      method: 'POST',
      url: '/v1/session',
      payload: { username: body.username, password: body.password },
    })
    expect(relogin.statusCode).toBe(200)
  }, 20000)
  it('rejects scope injection, reserved seed logins, and cross-origin registration before writing data', async () => {
    const valid = {
      username: 'secure_owner',
      password: 'strong-password-for-test',
      company: { name: 'Новый профиль', industry: 'Металлургия', region: 'Урал' },
    }
    const count = (await runtime.database!.db.select().from(t.users)).length
    for (const payload of [
      { ...valid, companyIds: ['U_1'] },
      { ...valid, username: 'client_u_999' },
      { ...valid, company: { ...valid.company, id: 'U_1' } },
    ])
      expect(
        (await app.inject({ method: 'POST', url: '/v1/registrations', payload })).statusCode,
      ).toBe(400)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/registrations',
          payload: valid,
          headers: { origin: 'https://other.example' },
        })
      ).statusCode,
    ).toBe(401)
    expect(await runtime.database!.db.select().from(t.users)).toHaveLength(count)
  })

  it('checks readiness against the migrated database and Redis', async () => {
    expect((await app.inject('/ready')).statusCode).toBe(200)
  })
})
