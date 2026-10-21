import { mkdir, writeFile } from 'node:fs/promises'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { buildAgentGraph, textOf } from '../agent/graph.js'
import { buildTaskPrompt, PROMPT_VERSION } from '../agent/prompts.js'
import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { costOf, createChatModel } from '../llm.js'
import type { ToolCallRecord } from '../tools/index.js'

const CASES = [
  { companyId: 'U_9250', question: 'Доходности ОФЗ выросли после заседания ЦБ 11 сентября. Как это влияет на стоимость финансирования компании?' },
  { companyId: 'U_1595', question: 'Банк ожидает охлаждения потребительского спроса. Что это значит для компании?' },
  { companyId: 'U_57706', question: 'Цены на бензин продолжают расти, инфляция ускорилась. Как это влияет на компанию?' },
  { companyId: 'U_408046', question: 'Как рост льготного кредитования и кредитов застройщикам влияет на компанию?' },
  { companyId: 'U_3263', question: 'Рынок труда остается напряженным, зарплаты растут. Что это значит для компании?' },
]

const models = process.argv.slice(2)
if (!models.length) throw new Error('Использование: pnpm agent:compare <modelId> [modelId ...]')

const config = loadConfig()
const ctx = await loadDataContext(config)
const knownIds = new Set([...ctx.bank.documents.map((d) => d.id), ...ctx.news.map((n) => n.id)])
const date = new Date().toISOString().slice(0, 10)
const answersDir = `${dataPaths(config).processed}/runs/agent-compare-${date}`
await mkdir(answersDir, { recursive: true })

type Row = {
  model: string
  companyId: string
  stopReason: string | null
  steps: number
  toolCalls: number
  tools: string[]
  bankHits: number
  citedBank: number
  citedNews: number
  unknownCitations: string[]
  ms: number
  tokens: number
  cost: number
  error?: string
}

const rows: Row[] = []
for (const c of CASES) {
  for (const modelId of models) {
    const audit: ToolCallRecord[] = []
    const graph = buildAgentGraph({
      ctx,
      model: createChatModel(config, modelId),
      limits: { maxSteps: config.AGENT_MAX_STEPS, maxToolCalls: config.AGENT_MAX_TOOL_CALLS },
      audit,
    })
    const started = Date.now()
    try {
      const result = await graph.invoke(
        { messages: [new HumanMessage(buildTaskPrompt({ question: c.question, asOf: date }))] },
        { configurable: { companyId: c.companyId }, recursionLimit: config.AGENT_MAX_STEPS * 3 },
      )
      const ai = result.messages.filter((m): m is AIMessage => m instanceof AIMessage)
      const answer = textOf(ai.at(-1)!)
      const cited = [...new Set(answer.match(/\b(?:bank|news)_[0-9a-f]{12}\b/g) ?? [])]
      const bankResults = result.messages.filter((m) => m.getType() === 'tool' && m.name === 'bank_search')
      const row: Row = {
        model: modelId,
        companyId: c.companyId,
        stopReason: result.stopReason,
        steps: result.steps,
        toolCalls: audit.length,
        tools: [...new Set(audit.map((a) => a.tool))],
        bankHits: bankResults.reduce((s, m) => s + ((JSON.parse(String(m.content)).results?.length as number) ?? 0), 0),
        citedBank: cited.filter((id) => id.startsWith('bank_')).length,
        citedNews: cited.filter((id) => id.startsWith('news_')).length,
        unknownCitations: cited.filter((id) => !knownIds.has(id)),
        ms: Date.now() - started,
        tokens: ai.reduce((s, m) => s + (m.usage_metadata?.total_tokens ?? 0), 0),
        cost: ai.reduce((s, m) => s + costOf(m), 0),
      }
      rows.push(row)
      await writeFile(
        `${answersDir}/${c.companyId}_${modelId.replace(/\//g, '_')}.json`,
        JSON.stringify({ ...row, question: c.question, promptVersion: PROMPT_VERSION, toolTrace: audit, answer }, null, 2),
      )
    } catch (error) {
      rows.push({ model: modelId, companyId: c.companyId, stopReason: null, steps: 0, toolCalls: 0, tools: [], bankHits: 0, citedBank: 0, citedNews: 0, unknownCitations: [], ms: Date.now() - started, tokens: 0, cost: 0, error: (error as Error).message.slice(0, 120) })
    }
    const r = rows.at(-1)!
    console.log(`${r.companyId} ${r.model}: ${r.error ?? `${r.stopReason}, шагов ${r.steps}, вызовов ${r.toolCalls}, ссылок банк/новости ${r.citedBank}/${r.citedNews}, ${(r.ms / 1000).toFixed(1)} с, ${r.cost.toFixed(3)}`}`)
  }
}

const table = [
  '| Компания | Модель | Остановка | Шагов | Вызовов | Инструменты | Фрагментов банка найдено | Ссылок на банк / новости | Несуществующие ссылки | Время, с | Токены | Стоимость |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) =>
    r.error
      ? `| ${r.companyId} | ${r.model} | ❌ ${r.error.replace(/\|/g, '/')} | | | | | | | | | |`
      : `| ${r.companyId} | ${r.model} | ${r.stopReason} | ${r.steps} | ${r.toolCalls} | ${r.tools.join(', ')} | ${r.bankHits} | ${r.citedBank} / ${r.citedNews} | ${r.unknownCitations.join(', ') || '—'} | ${(r.ms / 1000).toFixed(1)} | ${r.tokens} | ${r.cost.toFixed(3)} |`,
  ),
]
const totals = models.map((m) => {
  const own = rows.filter((r) => r.model === m && !r.error)
  const sum = (f: (r: Row) => number) => own.reduce((s, r) => s + f(r), 0)
  return `| ${m} | ${own.filter((r) => r.stopReason === 'answered').length}/${own.length} | ${(sum((r) => r.steps) / own.length).toFixed(1)} | ${(sum((r) => r.ms) / own.length / 1000).toFixed(1)} | ${Math.round(sum((r) => r.tokens) / own.length)} | ${sum((r) => r.cost).toFixed(3)} |`
})
const report = [
  `# Сравнение моделей агента — ${date}`,
  '',
  `Промпт: ${PROMPT_VERSION}. reasoning_effort: ${config.LLM_REASONING_EFFORT}. Лимиты: ${config.AGENT_MAX_STEPS} шагов, ${config.AGENT_MAX_TOOL_CALLS} вызовов.`,
  'Полные ответы сохранены вне git (`data/processed/runs/`): содержат цитаты материалов банка.',
  '',
  '## Итого по моделям',
  '',
  '| Модель | Ответил сам | Шагов в среднем | Время в среднем, с | Токенов в среднем | Стоимость всего |',
  '| --- | --- | --- | --- | --- | --- |',
  ...totals,
  '',
  '## По вопросам',
  '',
  ...CASES.map((c) => `- **${c.companyId}**: ${c.question}`),
  '',
  ...table,
  '',
].join('\n')
const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`agent-compare-${date}.md`, outDir), report)
console.log(`\nОтчет: results/agent-compare-${date}.md, ответы: ${answersDir}`)
