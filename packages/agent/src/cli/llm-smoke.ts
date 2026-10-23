import { mkdir, writeFile } from 'node:fs/promises'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { loadConfig } from '../config.js'
import { costOf, createChatModel, requireLlm } from '../llm.js'

const config = loadConfig()
const { baseURL, apiKey } = requireLlm(config)

const listed = await fetch(`${baseURL.replace(/\/$/, '')}/models`, { headers: { authorization: `Bearer ${apiKey}` } })
  .then(async (r) => (r.ok ? ((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [] : []))
  .catch(() => [] as string[])
console.log(`GET /models: ${listed.length ? listed.join(', ') : 'недоступно'}\n`)

const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [config.LLM_MODEL_AGENT].filter((m): m is string => Boolean(m))
if (!models.length) throw new Error('Передайте ID моделей аргументами или задайте LLM_MODEL_AGENT')

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1] ?? text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('В ответе нет JSON-объекта')
  return JSON.parse(body.slice(start, end + 1))
}

const keyRate = tool(async () => JSON.stringify({ rate: 14.0, date: '2026-09-11' }), {
  name: 'get_key_rate',
  description: 'Текущая ключевая ставка Банка России',
  schema: z.object({}),
})

type Check = { ok: boolean; ms: number; tokens?: number; reasoning?: number; cost?: number; note: string }

async function timed(run: () => Promise<{ ok: boolean; message?: AIMessage; note: string }>): Promise<Check> {
  const started = Date.now()
  try {
    const { ok, message, note } = await run()
    return {
      ok,
      ms: Date.now() - started,
      tokens: message?.usage_metadata?.total_tokens,
      reasoning: message?.usage_metadata?.output_token_details?.reasoning,
      cost: message ? costOf(message) : undefined,
      note,
    }
  } catch (error) {
    return { ok: false, ms: Date.now() - started, note: (error as Error).message.slice(0, 160) }
  }
}

const rows: string[] = []
for (const id of models) {
  const model = createChatModel(config, id, { temperature: 0 })

  const plain = await timed(async () => {
    const m = (await model.invoke([new HumanMessage('Ответь одним словом: в какой валюте Банк России устанавливает ключевую ставку?')])) as AIMessage
    return { ok: typeof m.content === 'string' && m.content.length > 0, message: m, note: String(m.content).slice(0, 60) }
  })

  const tools = await timed(async () => {
    const m = (await model.bindTools!([keyRate]).invoke([new HumanMessage('Какая сейчас ключевая ставка? Используй инструмент.')])) as AIMessage
    const called = m.tool_calls?.map((c) => c.name) ?? []
    return { ok: called.includes('get_key_rate'), message: m, note: called.length ? `вызвал ${called.join(',')}` : 'не вызвал инструмент' }
  })

  const json = await timed(async () => {
    const m = (await model.invoke([
      new HumanMessage('Верни только JSON вида {"sector": string, "risks": string[]} для новости: "ЦБ сохранил ставку 14%". Без текста вокруг.'),
    ])) as AIMessage
    const parsed = z.object({ sector: z.string(), risks: z.array(z.string()) }).safeParse(parseJsonObject(String(m.content)))
    return { ok: parsed.success, message: m, note: parsed.success ? 'валидный JSON' : 'не прошел схему' }
  })

  const cell = (c: Check) =>
    `${c.ok ? '✅' : '❌'} ${c.ms} мс${c.tokens ? `, ${c.tokens} ток.` : ''}${c.reasoning ? ` (рассужд. ${c.reasoning})` : ''}${c.cost ? `, ${c.cost.toFixed(4)}` : ''} — ${c.note.replace(/\|/g, '/')}`
  rows.push(`| ${id} | ${cell(plain)} | ${cell(tools)} | ${cell(json)} |`)
  console.log(rows.at(-1))
}

const report = [
  `# LLM smoke test — ${new Date().toISOString()}`,
  '',
  `Gateway models: ${listed.join(', ') || 'н/д'}`,
  '',
  `reasoning_effort: ${config.LLM_REASONING_EFFORT}. Стоимость — поле usage.cost из ответа шлюза.`,
  '',
  '| Модель | Ответ | Tool calling | JSON |',
  '| --- | --- | --- | --- |',
  ...rows,
  '',
].join('\n')
const dir = new URL('../../results/', import.meta.url)
await mkdir(dir, { recursive: true })
const file = new URL(`llm-smoke-${new Date().toISOString().slice(0, 10)}.md`, dir)
await writeFile(file, report)
console.log(`\nОтчет: ${file.pathname}`)
