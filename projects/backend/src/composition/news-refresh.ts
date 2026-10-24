import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Queue, Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { dataPaths, reloadNews, type DataContext } from '@alfa/agent'
import { forgetNewsTags } from '../modules/analytics/infrastructure/agent-runtime.js'
import type { Config } from '../config.js'
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const REFRESH_TIMEOUT_MS = 30 * 60_000
// API and worker hold the corpus in memory; reload it when news:refresh writes its marker.
export function watchNewsRefresh(
  config: Config,
  data: DataContext,
  log: (message: string) => void,
  intervalMs = 60_000,
) {
  if (config.AGENT_PROVIDER === 'fixture' || !config.DATA_DIR) return () => {}
  const marker = dataPaths({ DATA_DIR: config.DATA_DIR }).newsRefreshed
  let seen: number | undefined
  let checking = false
  const check = async () => {
    if (checking) return
    checking = true
    try {
      const mtime = (await stat(marker).catch(() => undefined))?.mtimeMs
      if (seen === undefined || mtime === undefined || mtime === seen) {
        seen ??= mtime ?? 0
        return
      }
      seen = mtime
      forgetNewsTags(config.DATA_DIR)
      log(`News corpus reloaded: ${await reloadNews(data, { DATA_DIR: config.DATA_DIR })} items`)
    } catch (error) {
      log(`News corpus reload failed: ${error instanceof Error ? error.message : 'Error'}`)
    } finally {
      checking = false
    }
  }
  void check()
  const timer = setInterval(() => void check(), intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
function runRefresh(env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['--filter', '@alfa/agent', 'news:refresh'], {
      cwd: root,
      env,
      stdio: 'inherit',
    })
    const timeout = setTimeout(() => child.kill('SIGTERM'), REFRESH_TIMEOUT_MS)
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error(`news:refresh exited with ${signal ?? code}`))
    })
  })
}
// One scheduler entry in Redis, so several workers still refresh once per day.
export async function scheduleNewsRefresh(config: Config, connection: Redis) {
  const queue = new Queue('news-refresh', { connection, prefix: config.QUEUE_PREFIX })
  if (!config.NEWS_REFRESH_CRON || config.AGENT_PROVIDER !== 'langgraph') {
    await queue.removeJobScheduler('daily')
    await queue.close()
    return async () => {}
  }
  await queue.upsertJobScheduler(
    'daily',
    { pattern: config.NEWS_REFRESH_CRON, tz: config.NEWS_REFRESH_TZ },
    { name: 'refresh', opts: { removeOnComplete: 30, removeOnFail: 30 } },
  )
  const worker = new Worker(
    'news-refresh',
    () => runRefresh({ ...process.env, DATA_DIR: config.DATA_DIR }),
    {
      connection,
      prefix: config.QUEUE_PREFIX,
      concurrency: 1,
      lockDuration: REFRESH_TIMEOUT_MS,
    },
  )
  worker.on('failed', (_, error) => process.stderr.write(`News refresh failed: ${error.message}\n`))
  worker.on('completed', () => process.stdout.write('News refresh completed\n'))
  return async () => {
    await worker.close()
    await queue.close()
  }
}
