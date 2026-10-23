import { writeFile } from 'node:fs/promises'
import { dataPaths, loadConfig } from '../config.js'
import { readJsonNews } from '../data/news-file.js'
import { extractArticleText, fetchArticleHtml, isAllowedArticleUrl } from '../news/fulltext.js'
import { readNewsTags } from '../news/tagging.js'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const minLength = Number(arg('min-length') ?? 600)
const limit = Number(arg('limit') ?? Infinity)
const since = arg('since')
const concurrency = Number(arg('concurrency') ?? 3)
const pauseMs = Number(arg('pause-ms') ?? 400)

const paths = dataPaths(loadConfig())
const news = await readJsonNews(paths.news)
const todo = news
  .filter((n) => n.textSource !== 'article' && n.text.length < minLength)
  .filter((n) => !since || (n.publishedAt ?? '') >= since)
  .filter((n) => isAllowedArticleUrl(new URL(n.url)))
  .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  .slice(0, limit)
console.log(`Новостей: ${news.length}, короче ${minLength} символов и доступны для загрузки: ${todo.length}`)

const updated = new Set<string>()
const stats: Record<string, { ok: number; failed: number; methods: Record<string, number> }> = {}
let next = 0
async function worker() {
  while (next < todo.length) {
    const item = todo[next++]!
    const s = (stats[item.sourceId] ??= { ok: 0, failed: 0, methods: {} })
    try {
      const html = await fetchArticleHtml(item.url, AbortSignal.timeout(15000))
      const article = extractArticleText(html)
      if (article && article.text.length > item.text.length && article.text.length >= 200) {
        item.text = article.text
        item.textSource = 'article'
        updated.add(item.id)
        s.ok++
        s.methods[article.method] = (s.methods[article.method] ?? 0) + 1
      } else s.failed++
    } catch {
      s.failed++
    }
    await new Promise((r) => setTimeout(r, pauseMs))
  }
}
await Promise.all(Array.from({ length: concurrency }, worker))
await writeFile(paths.news, JSON.stringify(news))

const tagFile = await readNewsTags(paths.newsTags)
if (tagFile && updated.size) {
  for (const id of updated) delete tagFile.tags[id]
  await writeFile(paths.newsTags, JSON.stringify(tagFile, null, 1))
}
for (const [source, s] of Object.entries(stats))
  console.log(`  ${source}: полный текст ${s.ok}, не удалось ${s.failed} ${JSON.stringify(s.methods)}`)
console.log(`Готово: обновлено ${updated.size}. Разметка этих новостей сброшена — выполните pnpm news:tag.`)
