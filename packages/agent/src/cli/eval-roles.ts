import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages'
import { createFeedFinalizer, type ParsedEvent } from '../agent/feed-parser.js'
import { buildAgentGraph, textOf } from '../agent/graph.js'
import { buildTaskPrompt, PROMPT_VERSION } from '../agent/prompts.js'
import { dataPaths, loadConfig } from '../config.js'
import { buildDataContext, loadDataContext, type DataContext } from '../data/context.js'
import { expertGrade, expertRoles, type ExpertLabels } from '../eval/labels.js'
import { mean, overlap, roleGrades } from '../eval/metrics.js'
import { FEATURE_IDS } from '../features.js'
import { costOf, createChatModel } from '../llm.js'
import { loadNewsTags } from '../news/tagging.js'
import { rankNewsForCompany, type Perspective } from '../news/ranking.js'

type RankingSet = { asOf: string; companies: { id: string; labels: Record<string, number> }[]; roles: Record<string, string[]> }
type Card = Omit<ParsedEvent, 'risks' | 'opportunities' | 'actions'> & { risks: string[]; opportunities: string[]; actions: string[] }
type Feed = { companyId: string; perspective: Perspective; candidates: string[]; labels: Record<string, number>; cards: Card[]; skipped: string[]; issues: string[]; cost: number; ms: number; error?: string }

const SETS = ['ranking-set.json', 'ranking-holdout.json', 'ranking-holdout-2.json']
const PERSPECTIVES: Perspective[] = ['cfo', 'ceo']
const EVENTS = 5
const CONCURRENCY = 4
// Lexical proxy for the role's area: CFO money channels versus CEO business channels.
const SPHERE: Record<Perspective, RegExp> = {
  cfo: /ставк|долг|кредит|лизинг|ликвидн|оборотн|курс|процент|рефинанс|заимств|облигац|платеж|дебитор|кредитор|гарант|депозит|налог|маржинальн|себестоим|денежн|финансир/i,
  ceo: /спрос|продаж|выручк|клиент|покупател|постав|закуп|производ|рын[ко]|конкурент|заказ|отгрузк|логистик|персонал|сотрудник|регион|отрасл|контрагент|строительств|экспорт|импорт/i,
}

const config = loadConfig()
const tag = process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] ?? PROMPT_VERSION
const modelId: string = config.LLM_MODEL_AGENT ?? ''
if (!modelId) throw new Error('LLM_MODEL_AGENT не задан в packages/agent/.env')
const full = await loadDataContext(config)
const tags = await loadNewsTags(dataPaths(config).newsTags)
const corpora = new Map<string, DataContext>()
const corpusAt = (asOf: string) => {
  let at = corpora.get(asOf)
  if (!at) corpora.set(asOf, (at = buildDataContext(full.companies, full.bank, full.news.filter((n) => n.fetchedAt <= asOf))))
  return at
}

async function feed(set: RankingSet, companyId: string, perspective: Perspective): Promise<Feed> {
  const ctx = corpusAt(set.asOf)
  const labels = roleGrades(set.companies.find((c) => c.id === companyId)!.labels, set.roles, perspective)
  const ranked = rankNewsForCompany(ctx, tags, companyId, { perspective, asOf: set.asOf, limit: EVENTS })
  const graph = buildAgentGraph({
    ctx,
    model: createChatModel(config, modelId),
    limits: { maxSteps: config.AGENT_MAX_STEPS, maxToolCalls: config.AGENT_MAX_TOOL_CALLS },
    finalize: createFeedFinalizer({ ctx, eventIds: ranked.map((r) => r.news.id), featureIds: [...FEATURE_IDS], mode: 'feed' }),
  })
  const base = { companyId, perspective, candidates: ranked.map((r) => r.news.id), labels }
  const started = Date.now()
  try {
    const prompt = buildTaskPrompt({
      mode: 'feed',
      question: `Разбери события для компании в ракурсе ${perspective}. Подготовь отдельный краткий разбор каждого выбранного события; позицию банка проверь отдельно.`,
      asOf: set.asOf.slice(0, 10),
      events: ranked.map((n) => ({ id: n.news.id, title: n.news.title, text: n.news.text, publishedAt: n.news.publishedAt, reasons: n.relevance.reasons })),
    })
    const result = await graph.invoke({ messages: [new HumanMessage(prompt)] }, { configurable: { companyId }, recursionLimit: config.AGENT_MAX_STEPS * 3 })
    const messages = result.messages as BaseMessage[]
    const draft = JSON.parse(textOf(result.structured as BaseMessage)) as { events: Card[]; skipped: { eventId: string }[]; issues: string[] }
    return {
      ...base,
      cards: draft.events.filter((e) => e.claims.some((c) => c.kind === 'fact')),
      skipped: draft.skipped.map((s) => s.eventId),
      issues: draft.issues,
      cost: messages.filter((m): m is AIMessage => m instanceof AIMessage).reduce((s, m) => s + costOf(m), 0),
      ms: Date.now() - started,
    }
  } catch (error) {
    return { ...base, cards: [], skipped: [], issues: [], cost: 0, ms: Date.now() - started, error: (error as Error).message.slice(0, 120) }
  }
}

const expertPath = new URL('../../eval/expert-labels.json', import.meta.url)
const experts: ExpertLabels = existsSync(expertPath) ? JSON.parse(await readFile(expertPath, 'utf8')) : { pairs: {} }
const jobs: (() => Promise<Feed>)[] = []
for (const file of SETS) {
  const set = JSON.parse(await readFile(new URL(`../../eval/${file}`, import.meta.url), 'utf8')) as RankingSet
  for (const c of set.companies)
    for (const newsId of Object.keys(c.labels)) {
      const pair = experts.pairs[`${c.id}|${newsId}`]
      const grade = expertGrade(pair)
      if (grade === undefined) continue
      c.labels[newsId] = grade
      set.roles[newsId] = expertRoles(pair) ?? set.roles[newsId] ?? ['ceo']
    }
  for (const c of set.companies) for (const p of PERSPECTIVES) jobs.push(() => feed(set, c.id, p))
}
const feeds: Feed[] = []
let next = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const f = await jobs[next++]!()
      feeds.push(f)
      console.log(`${f.companyId} ${f.perspective}: ${f.error ?? `${f.cards.length}/${f.candidates.length} карточек, ${(f.ms / 1000).toFixed(0)} с, ${f.cost.toFixed(2)} ₽`}`)
    }
  }),
)

const text = (c: Card) => [c.summary ?? '', ...c.claims.filter((x) => x.kind === 'ai_inference').map((x) => x.text), ...c.risks, ...c.opportunities, ...c.actions]
const sentences = (c: Card) => text(c).flatMap((t) => t.split(/(?<=[.!?])\s+/)).filter((s) => s.trim().length > 15)
const ok = feeds.filter((f) => !f.error)
const pct = (n: number) => `${Math.round(n * 100)}%`
const row = (p: Perspective) => {
  const fs = ok.filter((f) => f.perspective === p)
  const other: Perspective = p === 'cfo' ? 'ceo' : 'cfo'
  const cards = fs.flatMap((f) => f.cards.map((c) => ({ c, grade: f.labels[c.eventId] ?? 0 })))
  const useful = fs.flatMap((f) => f.candidates.filter((id) => (f.labels[id] ?? 0) >= 1).map((id) => f.cards.some((c) => c.eventId === id)))
  const ss = cards.flatMap(({ c }) => sentences(c))
  const own = ss.filter((s) => SPHERE[p].test(s)).length
  const foreign = ss.filter((s) => SPHERE[other].test(s) && !SPHERE[p].test(s)).length
  return {
    p,
    published: cards.length,
    candidates: fs.reduce((s, f) => s + f.candidates.length, 0),
    precision: cards.length ? cards.filter((x) => x.grade >= 1).length / cards.length : 0,
    recall: useful.length ? useful.filter(Boolean).length / useful.length : 0,
    grade: cards.length ? mean(cards.map((x) => x.grade)) : 0,
    focus: own + foreign ? own / (own + foreign) : 0,
    cost: mean(fs.map((f) => f.cost)),
    ms: mean(fs.map((f) => f.ms)),
  }
}
const rows = PERSPECTIVES.map(row)
const pairs = [...new Set(ok.map((f) => f.companyId))].flatMap((id) => {
  const [a, b] = PERSPECTIVES.map((p) => ok.find((f) => f.companyId === id && f.perspective === p))
  return (a?.cards ?? []).flatMap((x) => {
    const y = b?.cards.find((c) => c.eventId === x.eventId)
    return y ? [overlap(text(x).join(' '), text(y).join(' '))] : []
  })
})
const date = new Date().toISOString().slice(0, 10)
const report = [
  `# Оценка карточек по ролям — ${tag}, ${date}`,
  '',
  `Промпт ${PROMPT_VERSION}, модель ${modelId}. ${ok.length / 2} компаний из трех наборов отбора × ракурсы cfo и ceo; агент разбирает ${EVENTS} событий ML-отбора на корпусе на дату разметки, в ленту идут все прошедшие проверку. Оценка новости для роли — из \`eval/ranking-*.json\`: для чужой роли снижается на 1.`,
  '',
  '| Ракурс | Карточек | Полезны роли (оценка ≥ 1) | Полезные роли, дошедшие до ленты | Средняя оценка | Текст о сфере роли | ₽ на ленту | с на ленту |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.p} | ${r.published} из ${r.candidates} | ${pct(r.precision)} | ${pct(r.recall)} | ${r.grade.toFixed(2)} | ${pct(r.focus)} | ${r.cost.toFixed(2)} | ${(r.ms / 1000).toFixed(0)} |`),
  '',
  `Сходство карточек одного события для cfo и ceo: ${pairs.length ? mean(pairs).toFixed(2) : '—'} (${pairs.length} пар; ближе к 0 — карточки для ролей различаются). Ошибок запуска: ${feeds.length - ok.length}. Всего ${feeds.reduce((s, f) => s + f.cost, 0).toFixed(2)} ₽.`,
  '',
  '«Текст о сфере роли» — доля предложений карточки со словами своей роли среди предложений, где есть слова своей или чужой роли (cfo: ставка, долг, лизинг, ликвидность…; ceo: спрос, продажи, поставки, клиенты…). Эвристика.',
  '',
].join('\n')
const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`eval-roles-${date}-${tag}.md`, outDir), report)
await mkdir(`${dataPaths(config).processed}/runs`, { recursive: true })
await writeFile(`${dataPaths(config).processed}/runs/eval-roles-${date}-${tag}.json`, JSON.stringify(feeds, null, 1))
console.log(`\n${report}`)
