import { dataPaths, loadConfig } from '../config.js'
import { loadCompanyStore } from '../data/companies.js'
import { readJsonNews } from '../data/news-file.js'
import { createChatModel } from '../llm.js'
import { loadNewsTags, okvedDivisions, tagNewsBatch, writeNewsTags } from '../news/tagging.js'

const BATCH = 20
const CONCURRENCY = 3
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const force = process.argv.includes('--force')
const maxRub = Number(arg('max-rub') ?? 10)
const limit = Number(arg('limit') ?? Infinity)

const config = loadConfig()
const paths = dataPaths(config)
const model = createChatModel(config, config.LLM_MODEL_TAGGER, { temperature: 0 })
const [store, news] = await Promise.all([loadCompanyStore(paths), readJsonNews(paths.news)])
const divisions = okvedDivisions(store)
const tags = force ? new Map() : await loadNewsTags(paths.newsTags)
const todo = news.filter((n) => !tags.has(n.id)).slice(0, limit)
console.log(`Новостей: ${news.length}, уже размечено: ${news.filter((n) => tags.has(n.id)).length}, к разметке: ${todo.length}, разделов ОКВЭД: ${divisions.length}, модель: ${config.LLM_MODEL_TAGGER}`)

const batches = Array.from({ length: Math.ceil(todo.length / BATCH) }, (_, i) => todo.slice(i * BATCH, (i + 1) * BATCH))
let cost = 0
let failed = 0
let next = 0
async function worker() {
  while (next < batches.length && cost < maxRub) {
    const index = next++
    const batch = batches[index]!
    try {
      const result = await tagNewsBatch(model, divisions, batch)
      cost += result.cost
      for (const [id, tag] of result.tags) tags.set(id, tag)
      failed += batch.length - result.tags.size
      await writeNewsTags(paths.newsTags, config.LLM_MODEL_TAGGER, tags)
      console.log(`пачка ${index + 1}/${batches.length}: размечено ${result.tags.size}/${batch.length}, ${result.cost.toFixed(3)} ₽`)
    } catch (error) {
      failed += batch.length
      console.warn(`пачка ${index + 1}: ошибка — ${(error as Error).message}`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
if (cost >= maxRub) console.warn(`Остановлено по лимиту ${maxRub} ₽. Повторите команду — размеченные новости не будут запрошены заново.`)
console.log(`Готово. Размечено всего: ${tags.size}, не размечено в этом запуске: ${failed}, стоимость: ${cost.toFixed(3)} ₽ → ${paths.newsTags}`)
