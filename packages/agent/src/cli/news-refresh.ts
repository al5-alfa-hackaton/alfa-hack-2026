import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { dataPaths, loadConfig } from '../config.js'
import { readJsonNews } from '../data/news-file.js'

const paths = dataPaths(loadConfig())
const startedAt = new Date().toISOString()
const before = (await readJsonNews(paths.news).catch(() => [])).length
for (const step of [['ingest', '--news'], ['news:fulltext'], ['news:tag']]) {
  const result = spawnSync('pnpm', ['run', ...step], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) throw new Error(`news:refresh: шаг ${step[0]} завершился с кодом ${result.status}`)
}
const after = (await readJsonNews(paths.news)).length
await writeFile(paths.newsRefreshed, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), before, after }))
console.log(`news:refresh: новостей было ${before}, стало ${after}. API и worker подхватят корпус без перезапуска.`)
