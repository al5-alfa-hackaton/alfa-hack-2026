import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HumanMessage } from '@langchain/core/messages'
import { OCR_PROMPT } from '../agent/prompts.js'
import { textOf } from '../agent/graph.js'
import { dataPaths, loadConfig } from '../config.js'
import { exportPageImages, type BankOcr } from '../data/bank.js'
import { costOf, createChatModel } from '../llm.js'

const config = loadConfig()
if (!config.LLM_MODEL_VISION) throw new Error('Задайте LLM_MODEL_VISION в .env')
const force = process.argv.includes('--force')
const paths = dataPaths(config)
const model = createChatModel(config, config.LLM_MODEL_VISION, { temperature: 0 })
await mkdir(paths.bankOcr, { recursive: true })

type PartialOcr = { model: string; pages: string[] }

let totalTokens = 0
let totalCost = 0
let failed = 0
const started = Date.now()

for (const doc of await exportPageImages(paths.bankPdfDir, paths.bankPages)) {
  const out = join(paths.bankOcr, `${doc.documentId}.json`)
  const partialPath = join(paths.bankOcr, `${doc.documentId}.partial.json`)
  if (existsSync(out) && !force) {
    console.log(`skip ${doc.file} (уже распознан)`)
    continue
  }
  const partial: PartialOcr =
    existsSync(partialPath) && !force ? JSON.parse(await readFile(partialPath, 'utf8')) : { model: config.LLM_MODEL_VISION, pages: [] }

  let complete = true
  for (const [i, pagePath] of doc.pages.entries()) {
    if (typeof partial.pages[i] === 'string') continue
    const pageStarted = Date.now()
    try {
      const image = (await readFile(pagePath)).toString('base64')
      const response = await model.invoke([
        new HumanMessage({
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
          ],
        }),
      ])
      const text = textOf(response)
      const cost = costOf(response)
      totalTokens += response.usage_metadata?.total_tokens ?? 0
      totalCost += cost
      partial.pages[i] = text
      await writeFile(partialPath, JSON.stringify(partial))
      console.log(`${doc.file} стр. ${i + 1}/${doc.pages.length}: ${text.length} симв., ${Date.now() - pageStarted} мс, ${cost.toFixed(4)}`)
    } catch (error) {
      complete = false
      failed++
      console.warn(`${doc.file} стр. ${i + 1}/${doc.pages.length}: ошибка — ${(error as Error).message}`)
    }
  }

  if (!complete) continue
  const ocr: BankOcr = { documentId: doc.documentId, file: doc.file, model: partial.model, createdAt: new Date().toISOString(), pages: partial.pages }
  await writeFile(out, JSON.stringify(ocr, null, 2))
  await rm(partialPath, { force: true })
}

console.log(
  `Готово за ${((Date.now() - started) / 60000).toFixed(1)} мин. Токенов: ${totalTokens}, стоимость: ${totalCost.toFixed(3)}, ошибок: ${failed}.`,
)
console.log(failed ? 'Повторите pnpm bank:ocr — распознанные страницы не будут запрошены заново.' : 'Теперь выполните: pnpm ingest --bank')
