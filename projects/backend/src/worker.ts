import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { ExecutionError } from './modules/analytics/infrastructure/checkpoint-runtime.js'
import { loadConfig } from './config.js'
import { compose } from './composition/runtime.js'
const config = loadConfig()
if (!config.DATABASE_URL) throw new Error('Worker requires DATABASE_URL')
const runtime = await compose(config)
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null })
connection.on('error', () => {})
const queue = new Queue('analysis-runs', { connection, prefix: config.QUEUE_PREFIX })
const users = config.accounts
let closing = false,
  dispatching = false
let dispatchTask: Promise<void> | undefined
const worker = new Worker(
  'analysis-runs',
  async (job) => {
    const run = await runtime.store.claim(job.data.runId, job.data.version ?? 0)
    if (!run) return
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new Error('run_timeout')),
      config.RUN_TIMEOUT_MS,
    )
    let ticking = false
    const tick = setInterval(() => {
      if (ticking) return
      ticking = true
      void runtime.store
        .heartbeat(run.id, run.leaseToken)
        .then((status) => {
          if (status !== 'running') controller.abort(new Error('cancelled'))
        })
        .catch(() => controller.abort(new Error('dependency_unavailable')))
        .finally(() => {
          ticking = false
        })
    }, 500)
    try {
      const principal =
        config.DEV_AUTH && run.userId === 'local-demo'
          ? { id: run.userId, companyIds: ['U_1', 'U_3'] }
          : users.find((u) => u.id === run.userId)
      if (!principal) throw new Error('scope_revoked')
      runtime.companies.context(principal, run.companyId)
      const result = await runtime.agent.execute(
        run,
        controller.signal,
        (type, payload) => runtime.store.progress(run.id, type, payload, run.leaseToken),
        run.leaseToken,
      )
      controller.signal.throwIfAborted()
      await runtime.store.finish(run.id, result, undefined, run.leaseToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      await runtime.store.finish(
        run.id,
        undefined,
        error instanceof ExecutionError
          ? error.code
          : ['scope_revoked', 'run_timeout'].includes(message)
            ? message
            : 'agent_failed',
        run.leaseToken,
      )
    } finally {
      clearTimeout(timeout)
      clearInterval(tick)
    }
  },
  {
    connection,
    prefix: config.QUEUE_PREFIX,
    concurrency: 2,
    lockDuration: 60000,
    maxStalledCount: 0,
  },
)
worker.on('error', (error) => process.stderr.write(`Worker error: ${error.name}\n`))
async function dispatch() {
  if (closing || dispatching) return
  dispatching = true
  try {
    await runtime.store.recoverExpired()
    // SQL is authoritative even if Redis loses an acknowledged job or an old worker skipped it.
    for (const delivery of await runtime.store.deliveriesToReconcile()) {
      const job = await queue.getJob(`${delivery.runId}-${delivery.version}`)
      const state = await job?.getState()
      if (!job || state === 'completed' || state === 'failed') {
        if (job) await job.remove()
        await runtime.store.rearmDelivery(delivery.runId, delivery.version)
      }
    }
    for (const row of await runtime.store.pending()) {
      await queue.add(
        'analyze',
        { runId: row.runId, version: row.version },
        {
          jobId: `${row.runId}-${row.version}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      )
      await runtime.store.dispatched(row.runId, row.version)
    }
  } catch (error) {
    process.stderr.write(
      `Dispatcher unavailable: ${error instanceof Error ? error.name : 'Error'}\n`,
    )
  } finally {
    dispatching = false
  }
}
function scheduleDispatch() {
  if (!closing && !dispatching) dispatchTask = dispatch()
}
const timer = setInterval(scheduleDispatch, 1000)
scheduleDispatch()
await dispatchTask
async function close() {
  if (closing) return
  closing = true
  clearInterval(timer)
  await worker.close()
  await dispatchTask
  await queue.close()
  await connection.quit()
  await runtime.database!.pool.end()
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void close()
  })
process.stdout.write('Analysis worker ready\n')
