import { mkdir, writeFile } from 'node:fs/promises'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { buildAgentGraph, textOf } from '../agent/graph.js'
import { buildTaskPrompt, PROMPT_VERSION } from '../agent/prompts.js'
import { locateSources } from '../agent/sources.js'
import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { costOf, createChatModel } from '../llm.js'
import type { ToolCallRecord } from '../tools/index.js'

const [companyId, question, modelArg] = process.argv.slice(2)
if (!companyId || !question) throw new Error('Использование: pnpm agent <companyId> "<вопрос>" [modelId]')

const config = loadConfig()
const modelId = modelArg ?? config.LLM_MODEL_AGENT
if (!modelId) throw new Error('Задайте LLM_MODEL_AGENT в .env или передайте modelId третьим аргументом')
const ctx = await loadDataContext(config)
if (!ctx.companies.companies.has(companyId)) throw new Error(`Компания ${companyId} не найдена`)

const audit: ToolCallRecord[] = []
const graph = buildAgentGraph({
  ctx,
  model: createChatModel(config, modelId),
  limits: { maxSteps: config.AGENT_MAX_STEPS, maxToolCalls: config.AGENT_MAX_TOOL_CALLS },
  audit,
})

const started = Date.now()
const result = await graph.invoke(
  { messages: [new HumanMessage(buildTaskPrompt({ question, asOf: new Date().toISOString().slice(0, 10) }))] },
  { configurable: { companyId }, recursionLimit: config.AGENT_MAX_STEPS * 3 },
)

const aiMessages = result.messages.filter((m): m is AIMessage => m instanceof AIMessage)
const answer = textOf(aiMessages.at(-1)!)
const tokens = aiMessages.reduce((s, m) => s + (m.usage_metadata?.total_tokens ?? 0), 0)
const cost = aiMessages.reduce((s, m) => s + costOf(m), 0)
const sources = locateSources(answer, ctx, dataPaths(config))

const run = {
  companyId,
  question,
  model: modelId,
  promptVersion: PROMPT_VERSION,
  durationMs: Date.now() - started,
  steps: result.steps,
  tokens,
  cost,
  reasoningEffort: config.LLM_REASONING_EFFORT,
  stopReason: result.stopReason,
  toolCalls: audit,
  answer,
  sources,
}

console.log('===Вызовы инструментов===')
for (const c of audit) console.log(`${c.ok ? '✓' : '✗'} ${c.tool} ${JSON.stringify(c.args)} (${c.durationMs} мс)`)
console.log(`\n===Ответ (${modelId}, ${run.durationMs} мс, шагов ${run.steps}, токенов ${tokens}, стоимость ${cost.toFixed(4)})===`)
if (result.stopReason === 'limit') console.log('(лимит шагов исчерпан, ответ по собранным данным)')
console.log(answer || 'Модель вернула пустой ответ')
if (sources.length) {
  console.log('\n===Где посмотреть источники===')
  for (const s of sources) console.log(`${s.label}\n${s.where.map((w) => `   ${w}`).join('\n')}`)
}

const dir = `${dataPaths(config).processed}/runs`
await mkdir(dir, { recursive: true })
const file = `${dir}/${new Date().toISOString().replace(/[:.]/g, '-')}_${companyId}.json`
await writeFile(file, JSON.stringify(run, null, 2))
console.log(`\nСохранено: ${file}`)
