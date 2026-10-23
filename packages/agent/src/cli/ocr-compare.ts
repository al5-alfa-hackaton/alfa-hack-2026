import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HumanMessage } from '@langchain/core/messages'
import { OCR_PROMPT } from '../agent/prompts.js'
import { textOf } from '../agent/graph.js'
import { dataPaths, loadConfig } from '../config.js'
import { costOf, createChatModel } from '../llm.js'

const [pageArg, ...modelArgs] = process.argv.slice(2)
if (!pageArg || !modelArgs.length) throw new Error('Использование: pnpm ocr:compare <documentId>/p01.png <modelId> [modelId ...]')

const config = loadConfig()
const pagePath = join(dataPaths(config).bankPages, pageArg)
const image = (await readFile(pagePath)).toString('base64')
const pageSlug = pageArg.replace(/\.png$/, '').replace(/\//g, '_')
const outDir = new URL(`../../results/ocr-compare-${new Date().toISOString().slice(0, 10)}/${pageSlug}/`, import.meta.url)
await mkdir(outDir, { recursive: true })

const rows: string[] = []
for (const modelId of modelArgs) {
  const model = createChatModel(config, modelId, { temperature: 0 })
  const started = Date.now()
  try {
    const response = await model.invoke([
      new HumanMessage({
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
        ],
      }),
    ])
    const ms = Date.now() - started
    const text = textOf(response)
    const usage = response.usage_metadata
    await writeFile(new URL(`${modelId.replace(/\//g, '_')}.md`, outDir), text)
    rows.push(`| ${modelId} | ✅ | ${ms} | ${usage?.input_tokens ?? '?'} | ${usage?.output_tokens ?? '?'} | ${usage?.output_token_details?.reasoning ?? 0} | ${costOf(response).toFixed(4)} | ${text.length} |`)
  } catch (error) {
    rows.push(`| ${modelId} | ❌ ${(error as Error).message.slice(0, 120).replace(/\|/g, '/')} | ${Date.now() - started} | | | | | |`)
  }
  console.log(rows.at(-1))
}

const reportUrl = new URL('report.md', outDir)
const previous = existsSync(reportUrl) ? (await readFile(reportUrl, 'utf8')).split('\n') : []
const modelOf = (row: string) => row.split('|')[1]?.trim()
const rerun = new Set(rows.map(modelOf))
const kept = previous.filter((line) => /^\| \S+\/\S+ \|/.test(line) && !rerun.has(modelOf(line)))

const report = [
  `# OCR: сравнение моделей — ${pageArg}`,
  '',
  `reasoning_effort: ${config.LLM_REASONING_EFFORT}. Тексты распознавания лежат рядом, по файлу на модель.`,
  '',
  '| Модель | Результат | Время, мс | Вход, ток. | Выход, ток. | Рассужд., ток. | Стоимость | Символов |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...kept,
  ...rows,
  '',
].join('\n')
await writeFile(reportUrl, report)
console.log(`\nОтчет: ${outDir.pathname}report.md`)
