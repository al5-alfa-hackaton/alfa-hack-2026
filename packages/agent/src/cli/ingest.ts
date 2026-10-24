import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dataPaths, loadConfig } from '../config.js'
import { exportPageImages, extractBankCorpus } from '../data/bank.js'
import { fetchFeed, mergeNews, NEWS_SOURCES, type NewsItem } from '../data/news.js'
import { trimArticleText } from '../news/fulltext.js'

const args = new Set(process.argv.slice(2))
const all = !args.has('--bank') && !args.has('--news')
const paths = dataPaths(loadConfig())
await mkdir(paths.processed, { recursive: true })

if (all || args.has('--bank')) {
  const images = await exportPageImages(paths.bankPdfDir, paths.bankPages)
  console.log(`bank: изображения страниц (${images.reduce((s, d) => s + d.pages.length, 0)}) → ${paths.bankPages}`)
  const corpus = await extractBankCorpus(paths.bankPdfDir, paths.bankOcr)
  await writeFile(paths.bankChunks, JSON.stringify(corpus))
  for (const d of corpus.documents) {
    const chars = d.pages.reduce((s, p) => s + p.length, 0)
    console.log(`bank  ${d.id}  ${d.pages.length} стр.  ${chars} симв.  текст: ${d.textSource}  ${d.file}`)
  }
  console.log(`bank: ${corpus.documents.length} документов, ${corpus.chunks.length} фрагментов → ${paths.bankChunks}`)
}

if (all || args.has('--news')) {
  const existing: NewsItem[] = existsSync(paths.news) ? JSON.parse(await readFile(paths.news, 'utf8')) : []
  const fetched: NewsItem[] = []
  for (const source of NEWS_SOURCES) {
    try {
      const items = await fetchFeed(source, AbortSignal.timeout(20000))
      fetched.push(...items.map((n) => ({ ...n, text: trimArticleText(n.text) })))
      console.log(`news  ${source.id}: ${items.length}`)
    } catch (error) {
      console.warn(`news  ${source.id}: ошибка — ${(error as Error).message}`)
    }
  }
  const merged = mergeNews(existing, fetched)
  await writeFile(paths.news, JSON.stringify(merged))
  console.log(`news: было ${existing.length}, стало ${merged.length} → ${paths.news}`)
}
