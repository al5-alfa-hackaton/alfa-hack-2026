import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages'
import { createFeedFinalizer, type ParsedEvent } from '../agent/feed-parser.js'
import { buildAgentGraph, textOf } from '../agent/graph.js'
import { buildTaskPrompt, clarificationAllowed, PROMPT_VERSION } from '../agent/prompts.js'
import { VERIFY_PROMPT_VERSION } from '../agent/verify.js'
import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { bankAttribution, checkForm, mean, overlap, unsupportedNumbers, type FormExpectation } from '../eval/metrics.js'
import { FEATURE_IDS } from '../features.js'
import { costOf, createChatModel } from '../llm.js'
import { loadNewsTags } from '../news/tagging.js'
import { rankNewsForCompany, type Perspective, type RankedNewsItem } from '../news/ranking.js'

type Turn = { author: string; text: string }
type Battery = {
  feedCompanies: string[]
  holdoutCompanies: string[]
  questionCompanies: string[]
  perspective: Perspective
  eventsPerFeed: number
  cardsPerFeed: number
  questions: { id: string; text: string; conversation?: Turn[]; expect: FormExpectation }[]
}
type Draft = { verification?: { checked: number; rejected: { id: string; reason: string; text: string }[] }; events: (Omit<ParsedEvent, 'risks' | 'opportunities' | 'actions'> & { risks: string[]; opportunities: string[]; actions: string[] })[]; skipped: { eventId: string }[]; issues: string[] }
type Run = { draft: Draft; sources: string[]; cost: number; ms: number; steps: number; error?: string }

const battery = JSON.parse(await readFile(new URL('../../eval/questions.json', import.meta.url), 'utf8')) as Battery
const only = process.argv.find((a) => a.startsWith('--companies='))?.split('=')[1]?.split(',')
if (only) {
  battery.feedCompanies = battery.feedCompanies.filter((c) => only.includes(c))
  battery.holdoutCompanies = battery.holdoutCompanies.filter((c) => only.includes(c))
  battery.questionCompanies = battery.questionCompanies.filter((c) => only.includes(c))
}
const config = loadConfig()
const ctx = await loadDataContext(config)
const tags = await loadNewsTags(dataPaths(config).newsTags)
const asOf = new Date().toISOString()
const date = asOf.slice(0, 10)
const featureIds = [...FEATURE_IDS]
const verify = process.argv.includes('--verify')
const modelId: string = config.LLM_MODEL_AGENT ?? ''
if (!modelId) throw new Error('LLM_MODEL_AGENT не задан в packages/agent/.env')

async function run(companyId: string, ranked: RankedNewsItem[], prompt: Parameters<typeof buildTaskPrompt>[0], conversation: Turn[] = [], maxCards?: number): Promise<Run> {
  const mode = prompt.mode ?? 'feed'
  let verifyCost = 0
  const graph = buildAgentGraph({
    ctx,
    model: createChatModel(config, modelId),
    limits: { maxSteps: config.AGENT_MAX_STEPS, maxToolCalls: config.AGENT_MAX_TOOL_CALLS },
    finalize: createFeedFinalizer({
      ctx,
      eventIds: ranked.map((r) => r.news.id),
      featureIds,
      mode,
      allowClarification: clarificationAllowed(conversation, mode === 'question' ? prompt.question : undefined),
      ...(mode === 'question' ? { question: prompt.question } : {}),
      ...(maxCards ? { maxCards } : {}),
      ...(verify
        ? {
            verify: async (messages: BaseMessage[]) => {
              const response = await createChatModel(config, modelId, { temperature: 0 }).invoke(messages)
              verifyCost += costOf(response)
              return response
            },
          }
        : {}),
    }),
  })
  const started = Date.now()
  try {
    const result = await graph.invoke(
      { messages: [new HumanMessage(buildTaskPrompt({ ...prompt, conversation }))] },
      { configurable: { companyId }, recursionLimit: config.AGENT_MAX_STEPS * 3 },
    )
    const messages = result.messages as BaseMessage[]
    const draft = JSON.parse(textOf(result.structured as BaseMessage)) as Draft
    return {
      draft,
      sources: messages.map(textOf),
      cost: messages.filter((m): m is AIMessage => m instanceof AIMessage).reduce((s, m) => s + costOf(m), 0) + verifyCost,
      ms: Date.now() - started,
      steps: result.steps,
    }
  } catch (error) {
    return { draft: { events: [], skipped: [], issues: [] }, sources: [], cost: 0, ms: Date.now() - started, steps: 0, error: (error as Error).message.slice(0, 120) }
  }
}

const generated = (e: Draft['events'][number]) => [
  e.summary ?? '',
  e.answer ?? '',
  ...e.claims.filter((c) => c.kind === 'ai_inference').map((c) => c.text),
  ...e.risks,
  ...e.opportunities,
  ...e.actions,
]
const count = (issues: string[], re: RegExp) => issues.filter((i) => re.test(i)).length
const bankQuotes = (e: Draft['events'][number]) => e.claims.filter((c) => c.kind === 'bank_position').length
const attribution = (events: Draft['events'], issues: string[]) => {
  const perEvent = events.map((e) => bankAttribution(generated(e), bankQuotes(e)))
  const wrongSource = count(issues, /не на материал банка/)
  return { mentions: perEvent.reduce((s, a) => s + a.mentions, 0) + wrongSource, unsupported: perEvent.reduce((s, a) => s + a.unsupported, 0) + wrongSource }
}
const runsDir = `${dataPaths(config).processed}/runs/eval-answers-${date}`
await mkdir(runsDir, { recursive: true })

type FeedRow = {
  companyId: string
  holdout: boolean
  requested: number
  published: number
  skipped: number
  facts: number
  quotesRejected: number
  noConsequences: number
  featuresDropped: number
  numbers: string[]
  filled: number
  bank: { mentions: number; unsupported: number }
  withBank: number
  run: Run
  cards: Draft['events']
}
const feeds: FeedRow[] = []
for (const companyId of [...battery.feedCompanies, ...battery.holdoutCompanies]) {
  const ranked = rankNewsForCompany(ctx, tags, companyId, { perspective: battery.perspective, asOf, limit: battery.eventsPerFeed })
  const r = await run(companyId, ranked, {
    mode: 'feed',
    question: `Разбери события для компании в ракурсе ${battery.perspective}. Подготовь отдельный краткий разбор каждого выбранного события; позицию банка проверь отдельно.`,
    asOf: date,
    events: ranked.map((n) => ({ id: n.news.id, title: n.news.title, text: n.news.text, publishedAt: n.news.publishedAt, reasons: n.relevance.reasons })),
  }, [], battery.cardsPerFeed)
  const published = r.draft.events.filter((e) => e.claims.some((c) => c.kind === 'fact'))
  const row: FeedRow = {
    companyId,
    holdout: battery.holdoutCompanies.includes(companyId),
    requested: Math.min(ranked.length, battery.cardsPerFeed),
    noConsequences: r.draft.skipped.filter((x) => (x as { reason?: string }).reason === 'агент не нашел последствий для компании').length,
    published: published.length,
    skipped: r.draft.skipped.filter((x) => (x as { reason?: string }).reason !== 'агент не нашел последствий для компании' && (x as { reason?: string }).reason !== 'лимит карточек').length,
    facts: r.draft.events.reduce((s, e) => s + e.claims.filter((c) => c.kind !== 'ai_inference').length, 0),
    quotesRejected: count(r.draft.issues, /цитата не найдена|без идентификатора|не на материал банка/),
    featuresDropped: count(r.draft.issues, /неизвестны и убраны/),
    numbers: unsupportedNumbers(published.flatMap(generated).join('\n'), r.sources),
    filled: published.filter((e) => e.summary && e.risks.length + e.opportunities.length > 0 && e.actions.length > 0).length,
    bank: attribution(published, r.draft.issues),
    withBank: published.filter((e) => bankQuotes(e) > 0).length,
    run: r,
    cards: published,
  }
  feeds.push(row)
  await writeFile(`${runsDir}/feed_${companyId}.json`, JSON.stringify({ draft: r.draft, error: r.error }, null, 2))
  console.log(`лента ${companyId}: ${r.error ?? `${row.published}/${row.requested} опубликовано, пропущено ${row.skipped}, цитат отклонено ${row.quotesRejected}, чисел без источника ${row.numbers.length}, ${(r.ms / 1000).toFixed(0)} с, ${r.cost.toFixed(2)} ₽`}`)
}

type QuestionRow = { companyId: string; id: string; question: string; ok: boolean; detail: string; answer: string; clarification: string | null; numbers: string[]; bank: { mentions: number; unsupported: number }; run: Run }
const questions: QuestionRow[] = []
for (const companyId of battery.questionCompanies) {
  const feed = feeds.find((f) => f.companyId === companyId)
  const card = feed?.cards[0]
  if (!card) {
    console.log(`вопросы ${companyId}: нет опубликованной карточки, пропущено`)
    continue
  }
  const news = ctx.news.find((n) => n.id === card.eventId)!
  const ranked = rankNewsForCompany(ctx, tags, companyId, { perspective: battery.perspective, asOf, limit: battery.eventsPerFeed }).filter((r) => r.news.id === card.eventId)
  const context = {
    eventId: card.eventId,
    title: news.title,
    summary: card.summary,
    claims: card.claims.map((c) => ({ kind: c.kind, text: c.text, uncertainty: c.uncertainty })),
    risks: card.risks,
    actions: card.actions,
    evidence: card.claims.flatMap((c) => c.citations).map((c) => ({ documentId: c.documentId, quote: c.quote })),
  }
  for (const q of battery.questions) {
    const conversation = q.conversation ?? []
    const r = await run(
      companyId,
      ranked,
      {
        mode: 'question',
        question: q.text,
        asOf: date,
        events: ranked.map((n) => ({ id: n.news.id, title: n.news.title, text: n.news.text, publishedAt: n.news.publishedAt, reasons: n.relevance.reasons })),
        context,
      },
      conversation,
    )
    const event = r.draft.events.find((e) => e.answer)
    const clarification = event?.clarification ?? null
    const answer = (event?.answer ?? '').replace(clarification ?? '\u0000', '').trim()
    const form = r.error ? { ok: false, detail: r.error } : checkForm({ answer, clarification, claims: event?.claims.filter((c) => c.kind !== 'ai_inference').length ?? 0 }, q.expect)
    const sources = [...r.sources, q.text, ...conversation.map((t) => t.text)]
    const bank = event ? bankAttribution([answer], bankQuotes(event) + context.claims.filter((c) => c.kind === 'bank_position').length) : { mentions: 0, unsupported: 0 }
    const row: QuestionRow = { companyId, id: q.id, question: q.text, ...form, answer, clarification, numbers: unsupportedNumbers(answer, sources), bank, run: r }
    questions.push(row)
    await writeFile(`${runsDir}/question_${companyId}_${q.id}.json`, JSON.stringify({ question: q.text, draft: r.draft, error: r.error }, null, 2))
    console.log(`вопрос ${companyId} «${q.text}»: ${form.ok ? 'ок' : 'не ок'} — ${form.detail}, ${(r.ms / 1000).toFixed(0)} с, ${r.cost.toFixed(2)} ₽`)
  }
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0)
const okFeeds = feeds.filter((f) => !f.run.error && !f.holdout)
const okHoldout = feeds.filter((f) => !f.run.error && f.holdout)
const answered = questions.filter((q) => !q.run.error)
const repeats = battery.questionCompanies.flatMap((companyId) => {
  const own = answered.filter((q) => q.companyId === companyId && ['risks', 'actions', 'three_sentences', 'brief'].includes(q.id))
  return own.flatMap((a, i) => own.slice(i + 1).map((b) => overlap(a.answer, b.answer)))
})
const allCost = sum([...feeds.map((f) => f.run), ...questions.map((q) => q.run)], (r) => r.cost)
const cell = (t: string) => t.replace(/\|/g, '/').replace(/\n+/g, '<br>')

const report = [
  `# Оценка ответов агента — ${date}`,
  '',
  `Промпт ${PROMPT_VERSION}, модель ${modelId}. События отобраны ML-отбором, ракурс ${battery.perspective}: агент разбирает ${battery.eventsPerFeed} событий, в ленту идут ${battery.cardsPerFeed}, сначала с рисками или возможностями. Вопросы: \`eval/questions.json\`.`,
  'Ответ агента разбирается кодом (`createFeedFinalizer`), как в сервисе; цитаты сверяются с документами.',
  '',
  '## Итого',
  '',
  '| Метрика | Значение | Что показывает |',
  '| --- | --- | --- |',
  `| Карточек опубликовано | ${sum(okFeeds, (f) => f.published)} из ${sum(okFeeds, (f) => f.requested)} (${pct(sum(okFeeds, (f) => f.published), sum(okFeeds, (f) => f.requested))}), пропущено агентом ${sum(okFeeds, (f) => f.skipped)} | Сколько отобранных событий дошло до пользователя. Пропуск — агент счел событие не связанным с компанией |`,
  `| Точность цитат | ${pct(sum(okFeeds, (f) => f.facts), sum(okFeeds, (f) => f.facts + f.quotesRejected))} (отклонено ${sum(okFeeds, (f) => f.quotesRejected)}) | Доля фактов и позиций банка, найденных в документе дословно |`,
  `| Заполненность карточки | ${pct(sum(okFeeds, (f) => f.filled), sum(okFeeds, (f) => f.published))} | Есть главное, хотя бы один риск или возможность и шаг |`,
  `| Отброшено без последствий | ${sum(okFeeds, (f) => f.noConsequences)} из ${sum(okFeeds, (f) => f.run.draft.events.length + f.noConsequences)} разобранных | События, где агент не нашел ни риска, ни возможности; в ленту не попали, потому что были события с последствиями |`,
  `| Вывод ИИ выдан за позицию банка | ${sum(okFeeds, (f) => f.bank.unsupported) + sum(answered, (q) => q.bank.unsupported)} из ${sum(okFeeds, (f) => f.bank.mentions) + sum(answered, (q) => q.bank.mentions)} упоминаний | Текст ссылается на оценку Альфа-Банка, а дословной цитаты материала банка у события нет, или позиция банка ссылается не на материал банка. Цель — 0 |`,
  `| Карточек с позицией банка | ${pct(sum(okFeeds, (f) => f.withBank), sum(okFeeds, (f) => f.published))} | Доля опубликованных карточек с проверенной цитатой материала банка |`,
  `| Неизвестные признаки | ${sum(okFeeds, (f) => f.featuresDropped)} | Ссылки на признаки компании не из \`FEATURE_IDS\` |`,
  `| Числа без источника (лента) | ${sum(okFeeds, (f) => f.numbers.length)} | Числа в выводах, которых нет ни в новостях, ни в ответах инструментов. Эвристика: показывает кандидатов на выдумку |`,
  `| Форма ответа на вопрос | ${answered.filter((q) => q.ok).length} из ${questions.length} | N предложений, список, «кратко», приветствие, уточнение при нехватке данных и без повторного уточнения |`,
  `| Числа без источника (вопросы) | ${sum(answered, (q) => q.numbers.length)} | То же для ответов; данные пользователя из диалога считаются источником |`,
  `| Повтор между ответами | ${repeats.length ? mean(repeats).toFixed(2) : '—'} | Среднее сходство слов в ответах на «Какие риски?», «Что сделать?», «в 3 предложениях», «кратко». Ближе к 0 — ответы различаются |`,
  `| Время | лента ${(mean(okFeeds.map((f) => f.run.ms)) / 1000).toFixed(0)} с, вопрос ${(mean(answered.map((q) => q.run.ms)) / 1000).toFixed(0)} с | Среднее на запуск |`,
  `| Стоимость | лента ${mean(okFeeds.map((f) => f.run.cost)).toFixed(2)} ₽, вопрос ${mean(answered.map((q) => q.run.cost)).toFixed(2)} ₽, всего ${allCost.toFixed(2)} ₽ | Среднее на запуск |`,
  '',
  ...(verify
    ? [
        '## Проверка ответа',
        '',
        `Включена (\`--verify\`, промпт ${VERIFY_PROMPT_VERSION}): после разбора ответа отдельный вызов модели проверяет каждое предложение главного и ответа, выводы, риски, возможности и шаги по данным, которые собрал агент. Неподтвержденное убирается.`,
        '',
        `Проверено утверждений: ${[...feeds, ...questions].reduce((s, r) => s + (r.run.draft.verification?.checked ?? 0), 0)}, убрано: ${[...feeds, ...questions].reduce((s, r) => s + (r.run.draft.verification?.rejected.length ?? 0), 0)}.`,
        '',
        '| Запуск | Убранное утверждение | Причина |',
        '| --- | --- | --- |',
        ...[...feeds.map((f) => ({ name: `лента ${f.companyId}`, run: f.run })), ...questions.map((q) => ({ name: `${q.companyId} «${q.question}»`, run: q.run }))].flatMap(({ name, run }) =>
          (run.draft.verification?.rejected ?? []).map((v) => `| ${cell(name)} | ${cell(v.id.split('|').slice(1).join(' '))}: ${cell(v.text)} | ${cell(v.reason)} |`),
        ),
        '',
      ]
    : []),
  '## Отложенная проверка',
  '',
  `Компании ${battery.holdoutCompanies.join(', ')} (отложенная №2) — отрасли, которые не использовались ни при настройке промптов и отбора, ни при сравнении вариантов.`,
  '',
  '| Выборка | Опубликовано | Точность цитат | Заполненность | Числа без источника | Вывод ИИ выдан за позицию банка |',
  '| --- | --- | --- | --- | --- | --- |',
  ...[
    ['Настройка', okFeeds],
    ['Отложенная', okHoldout],
  ].map(
    ([name, rows]) =>
      `| ${name as string} | ${pct(sum(rows as FeedRow[], (f) => f.published), sum(rows as FeedRow[], (f) => f.requested))} | ${pct(sum(rows as FeedRow[], (f) => f.facts), sum(rows as FeedRow[], (f) => f.facts + f.quotesRejected))} | ${pct(sum(rows as FeedRow[], (f) => f.filled), sum(rows as FeedRow[], (f) => f.published))} | ${sum(rows as FeedRow[], (f) => f.numbers.length)} | ${sum(rows as FeedRow[], (f) => f.bank.unsupported)} |`,
  ),
  '',
  '## Лента',
  '',
  '| Компания | Опубликовано | Пропущено | Цитат отклонено | Числа без источника | Позиция банка без цитаты | Время, с | ₽ |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...feeds.map((f) =>
    f.run.error
      ? `| ${f.companyId}${f.holdout ? ' (отл.)' : ''} | ❌ ${cell(f.run.error)} | | | | | | |`
      : `| ${f.companyId}${f.holdout ? ' (отл.)' : ''} | ${f.published}/${f.requested} | ${f.skipped} | ${f.quotesRejected} | ${f.numbers.join(', ') || '—'} | ${f.bank.unsupported} из ${f.bank.mentions} | ${(f.run.ms / 1000).toFixed(0)} | ${f.run.cost.toFixed(2)} |`,
  ),
  '',
  '## Вопросы',
  '',
  '| Компания | Вопрос | Форма | Проверка | Числа без источника | Ответ |',
  '| --- | --- | --- | --- | --- | --- |',
  ...questions.map(
    (q) =>
      `| ${q.companyId} | ${cell(q.question)} | ${q.ok ? '✅' : '❌'} | ${cell(q.detail)} | ${q.numbers.join(', ') || '—'} | ${cell([q.answer, q.clarification && `Уточнение: ${q.clarification}`].filter(Boolean).join('\n'))} |`,
  ),
  '',
].join('\n')

const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`eval-answers-${date}.md`, outDir), report)
console.log(`\nВсего ${allCost.toFixed(2)} ₽. Отчет: results/eval-answers-${date}.md, черновики: ${runsDir}`)
