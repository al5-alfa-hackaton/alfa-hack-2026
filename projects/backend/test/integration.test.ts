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
      AUTH_USERS_JSON: JSON.stringify([
        { id: 'alice', token: alice, companyIds: ['U_1'] },
        { id: 'bob', token: bob, companyIds: ['U_3'] },
      ]),
    }
    const config = loadConfig(env)
    runtime = await compose(config)
    await migrate(runtime.database!.db, { migrationsFolder: 'drizzle' })
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
    expect(run.resultIds).toHaveLength(1)
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
    expect(failed.status).toBe('failed')
    expect(failed.error).toBe('worker_lost')
    const [budget] = await runtime.database!.db.select().from(t.budgets)
    expect(budget!.reserved).toBe(0)
    expect(budget!.spent).toBeGreaterThanOrEqual(1)
  })
  it('checks readiness against the migrated database and Redis', async () => {
    expect((await app.inject('/ready')).statusCode).toBe(200)
  })
})
