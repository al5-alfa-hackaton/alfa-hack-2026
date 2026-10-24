import { randomUUID, createHash } from 'node:crypto'
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'
import {
  buildAgentGraph,
  buildTaskPrompt,
  createChatModel,
  evidenceVerify,
  loadResearchConfig,
  textOf,
  type DataContext,
  type ToolCallRecord,
  PROMPT_VERSION,
  clarificationAllowed,
  createFeedFinalizer,
  dataPaths,
  loadNewsTags,
  ML_RANKING_VERSION,
  rankNewsForCompany,
  type NewsTags,
} from '@alfa/agent'
import type { RunnableConfig } from '@langchain/core/runnables'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import { rankNews, RANKING_VERSION, type RankedNews } from '../domain/ranking.js'
import { parseDraftBatch, type DraftClaim, type EventDraft } from './agent-draft.js'
import { CheckpointRuntime, ExecutionError } from './checkpoint-runtime.js'
import type { Config } from '../../../config.js'
import type { CompanyCatalog } from '../../companies/index.js'
import type { AgentRuntime, AgentResult, AnalyticsStore } from '../application/ports.js'
import type { Claim, Evidence, Insight, Run } from '../domain/model.js'
const normalized = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
const newsTagsCache = new Map<string, Promise<NewsTags>>()
function newsTagsFor(dataDir: string) {
  let tags = newsTagsCache.get(dataDir)
  if (!tags) newsTagsCache.set(dataDir, (tags = loadNewsTags(dataPaths({ DATA_DIR: dataDir }).newsTags)))
  return tags
}
export const forgetNewsTags = (dataDir: string) => newsTagsCache.delete(dataDir)
// Literal quote verification is separate from model output validation. It is not entailment proof.
export function gateDraft(
  draft: { claims: DraftClaim[] },
  ctx: DataContext,
  featureIds: string[],
  agentAnswer?: string,
) {
  const claims: Claim[] = [],
    evidence: Evidence[] = [],
    limitations: string[] = []
  for (const c of draft.claims) {
    if (c.companyFeatureIds.some((f) => !featureIds.includes(f))) {
      limitations.push('Исключён вывод с неизвестным признаком компании.')
      continue
    }
    const ids: string[] = []
    for (const citation of c.citations) {
      if (evidence.length >= 30) break
      if (
        agentAnswer !== undefined &&
        !normalized(agentAnswer).includes(normalized(citation.quote))
      )
        continue
      const verification = evidenceVerify(ctx, [citation])[0]
      if (!verification?.verified) continue
      const bank = ctx.bank.documents.find((d) => d.id === citation.documentId)
      const news = ctx.news.find((d) => d.id === citation.documentId)
      if (c.kind === 'bank_position' && !bank) continue
      if (!bank && !news) continue
      const id = `e${evidence.length + 1}`
      evidence.push({
        id,
        documentId: citation.documentId,
        sourceKind: bank ? 'bank' : 'news',
        quote: citation.quote,
        publishedAt: bank?.publishedAt ?? news?.publishedAt ?? null,
        page: verification.page ?? null,
        verified: true,
        contentExtent: bank ? 'page' : news?.textSource === 'article' ? 'full_text' : 'lead',
      })
      ids.push(id)
    }
    // Public factual text is restricted to an actual verified quotation. Interpretations are marked explicitly.
    if (
      c.kind !== 'ai_inference' &&
      (!ids.length ||
        !evidence.some(
          (e) => ids.includes(e.id) && normalized(e.quote).includes(normalized(c.text)),
        ))
    ) {
      limitations.push('Исключено неподтверждённое фактическое утверждение.')
      continue
    }
    if (c.kind === 'ai_inference' && (!c.companyFeatureIds.length || !c.uncertainty)) {
      limitations.push('Исключён вывод без признака компании и оговорки.')
      continue
    }
    claims.push({
      id: `c${claims.length + 1}`,
      kind: c.kind,
      text: c.text,
      evidenceIds: ids,
      companyFeatureIds: c.companyFeatureIds,
      uncertainty: c.uncertainty,
    })
  }
  const used = new Set(claims.flatMap((c) => c.evidenceIds))
  return { claims, evidence: evidence.filter((e) => used.has(e.id)), limitations }
}
function baseInsight(run: Run, catalog: CompanyCatalog): Insight {
  const context = catalog.context(run.companyId)
  return {
    id: randomUUID(),
    version: run.id,
    schemaVersion: '1',
    companyId: run.companyId,
    perspective: run.perspective,
    runId: run.id,
    generatedAt: new Date().toISOString(),
    dataMode: run.dataMode,
    profileVersion: context.profileVersion,
    corpusVersion: context.corpusVersion,
    status: 'insufficient_evidence',
    kind: 'context',
    event: {
      id: 'unconfirmed',
      title: 'Недостаточно подтверждённых данных',
      happenedAt: null,
      factClaimIds: [],
    },
    relevance: { score: 0, rank: 0, reasons: [] },
    summary: 'Подтверждённых данных для вывода недостаточно.',
    claims: [],
    evidence: [],
    risks: [],
    opportunities: [],
    actions: [],
    bankPosition: { status: 'missing', materialDates: [], claimIds: [] },
    missingData: context.gaps,
    limitations: context.limitations,
    usage: { inputTokens: 0, outputTokens: 0, cost: null, currency: null, certainty: 'unknown' },
  }
}
export class FixtureRuntime implements AgentRuntime {
  constructor(
    private readonly catalog: CompanyCatalog,
    private readonly ctx: DataContext,
    private readonly delayMs = 250,
  ) {}
  async execute(
    run: Run,
    signal: AbortSignal,
    progress: Parameters<AgentRuntime['execute']>[2],
  ): Promise<AgentResult> {
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        signal.removeEventListener('abort', abort)
        resolve()
      }
      const timer = setTimeout(done, this.delayMs)
      const abort = () => {
        clearTimeout(timer)
        reject(signal.reason)
      }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
    signal.throwIfAborted()
    await progress('tool.completed', { tool: 'company_profile', ok: true })
    const context = this.catalog.context(run.companyId)
    const ranked = rankNews(
      this.ctx.news,
      context.features,
      run.perspective,
      run.createdAt,
      run.input.timeRange,
    )
    const insights = ranked.map(({ news, relevance }) => {
      const i = baseInsight(run, this.catalog)
      i.status = 'partial'
      i.relevance = relevance
      i.event = {
        id: news.id,
        title: news.title,
        happenedAt: news.publishedAt,
        factClaimIds: ['c1'],
      }
      i.summary = news.text
      i.claims = [
        {
          id: 'c1',
          kind: 'fact',
          text: news.text,
          evidenceIds: ['e1'],
          companyFeatureIds: [],
          uncertainty: null,
        },
      ]
      i.evidence = [
        {
          id: 'e1',
          documentId: news.id,
          sourceKind: 'news',
          quote: news.text,
          publishedAt: news.publishedAt,
          page: null,
          verified: true,
          contentExtent: 'full_text',
        },
      ]
      i.limitations.push('Учебный запуск без LLM и аналитических материалов банка.')
      return i
    })
    return run.input.kind === 'question'
      ? {
          insights: [],
          answer:
            'Учебный ответ: материалов банка недостаточно. Для обоснованного вывода нужны источники и условия финансирования.',
        }
      : { insights }
  }
}
export class LangGraphRuntime implements AgentRuntime {
  constructor(
    private readonly config: Config,
    private readonly catalog: CompanyCatalog,
    private readonly ctx: DataContext,
    private readonly store: AnalyticsStore,
    private readonly checkpoints?: CheckpointRuntime,
  ) {}
  async execute(
    run: Run,
    signal: AbortSignal,
    progress: Parameters<AgentRuntime['execute']>[2],
    leaseToken?: string,
  ): Promise<AgentResult> {
    const context = this.catalog.context(run.companyId)
    const persistence =
      this.checkpoints && leaseToken ? this.checkpoints.forRun(run, leaseToken) : undefined
    if (!persistence && this.config.NODE_ENV !== 'test')
      throw new ExecutionError('checkpoint_storage_required')
    const config = loadResearchConfig({
      ...process.env,
      DATA_DIR: this.config.DATA_DIR,
      LLM_API_KEY: this.config.LLM_API_KEY,
      LLM_BASE_URL: this.config.LLM_BASE_URL,
      LLM_TIMEOUT_MS: String(this.config.LLM_TIMEOUT_MS),
      LLM_REASONING_EFFORT: 'none',
    })
    const model = createChatModel(config, this.config.LLM_MODEL_AGENT, { maxRetries: 0 })
    const newsTags: NewsTags = this.config.DATA_DIR
      ? await newsTagsFor(this.config.DATA_DIR)
      : new Map()
    let ranked: RankedNews[] = newsTags.size
      ? rankNewsForCompany(this.ctx, newsTags, run.companyId, {
          perspective: run.perspective,
          asOf: run.createdAt,
          limit: this.config.RANKING_LIMIT,
          since: run.input.timeRange?.since,
          until: run.input.timeRange?.until,
        })
      : rankNews(
          this.ctx.news,
          context.features,
          run.perspective,
          run.createdAt,
          run.input.timeRange,
          this.config.RANKING_LIMIT,
        )
    const isQuestion = run.input.kind === 'question'
    const question =
      run.input.question ??
      `Разбери события для компании в ракурсе ${run.perspective}. Подготовь отдельный краткий разбор каждого выбранного события; позицию банка проверь отдельно.`
    let insightContext: unknown = null
    let conversation: { author: string; text: string }[] = []
    if (isQuestion && run.input.insightId) {
      const p = { id: run.userId, companyIds: [run.companyId] },
        insight = await this.store.insight(p, run.input.insightId, run.perspective)
      const news = this.ctx.news.find((n) => n.id === insight.event.id)
      ranked = news ? [{ news, relevance: insight.relevance }] : []
      const messages = await this.store.messages(p, insight)
      insightContext = {
        eventId: insight.event.id,
        title: insight.event.title,
        version: insight.version,
        summary: insight.summary,
        claims: (insight.claims ?? []).map((c) => ({
          kind: c.kind,
          text: c.text,
          uncertainty: c.uncertainty,
        })),
        risks: insight.risks ?? [],
        actions: insight.actions ?? [],
        bankPosition: insight.bankPosition?.status ?? 'missing',
        evidence: (insight.evidence ?? []).map((e) => ({
          documentId: e.documentId,
          quote: e.quote,
          publishedAt: e.publishedAt,
        })),
      }
      // Exclude this run's own question and later messages so a resumed run keeps the same prompt.
      conversation = messages
        .filter((m) => m.at <= run.createdAt && m.runId !== run.id)
        .slice(-10)
        .map((m) => ({ author: m.author, text: m.text }))
    }
    const executionScope = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'graph-v4',
          runId: run.id,
          user: run.userId,
          company: run.companyId,
          perspective: run.perspective,
          profile: context.profileVersion,
          corpus: context.corpusVersion,
          prompt: PROMPT_VERSION,
          ranking: newsTags.size ? ML_RANKING_VERSION : RANKING_VERSION,
          model: this.config.LLM_MODEL_AGENT,
          gateway: this.config.LLM_BASE_URL,
          outputTokens: config.LLM_MAX_OUTPUT_TOKENS,
          steps: this.config.AGENT_MAX_STEPS,
          calls: this.config.AGENT_MAX_TOOL_CALLS,
          ranked: ranked.map((r) => r.news.id),
          question,
          insightContext,
          conversation,
        }),
      )
      .digest('hex')
    await persistence?.bindScope(executionScope)
    if (!ranked.length)
      return run.input.kind === 'question'
        ? { insights: [], answer: 'Исходные документы разбора недоступны в текущем корпусе.' }
        : { insights: [] }
    const featureIds = context.features.filter((f) => f.value !== null).map((f) => f.id)
    const feedCards = this.config.FEED_CARDS
    const audit: ToolCallRecord[] = []
    let agentAnswer = ''
    const invokeModel = persistence
      ? (key: string, invoke: () => Promise<BaseMessage>, messages: BaseMessage[]) =>
          persistence.call(key, invoke, messages)
      : undefined
    const graph = buildAgentGraph({
      ctx: this.ctx,
      model,
      limits: {
        maxSteps: this.config.AGENT_MAX_STEPS,
        maxToolCalls: this.config.AGENT_MAX_TOOL_CALLS,
      },
      audit,
      checkpointer: persistence?.checkpointer ?? new MemorySaver(),
      invokeModel,
      finalize: async (state, config) => {
        const last = state.messages.at(-1)
        agentAnswer = last ? textOf(last) : ''
        await progress('step.started', { phase: 'verifying_evidence' })
        return createFeedFinalizer({
          ctx: this.ctx,
          eventIds: ranked.map((r) => r.news.id),
          featureIds,
          mode: isQuestion ? 'question' : 'feed',
          allowClarification: clarificationAllowed(conversation, isQuestion ? question : undefined),
          question: isQuestion ? question : undefined,
          maxCards: isQuestion || !feedCards || feedCards >= ranked.length ? undefined : feedCards,
          verify: this.config.AGENT_VERIFY
            ? (messages) =>
                invokeModel
                  ? invokeModel('verify', () => model.invoke(messages), messages)
                  : model.invoke(messages)
            : undefined,
          fallback: modelFinalize,
        })(state, config)
      },
    })
    async function modelFinalize(state: { messages: BaseMessage[] }, config: RunnableConfig) {
        const messages = [
          ...state.messages,
          new HumanMessage(
            `Преобразуй только последний ответ агента в JSON {"events":[{"eventId":"ID события","summary":"строка Главное","kind":"risk|opportunity|context","answer":"строка Ответ для вопроса","risks":[],"opportunities":[],"actions":[],"claims":[{"kind":"fact|bank_position|ai_inference","text":"...","companyFeatureIds":[],"uncertainty":null,"citations":[{"documentId":"...","quote":"дословная цитата 12-300 символов"}]}]}]}. Допустимые события: ${ranked.map((r) => r.news.id).join(', ')}. Тип: риск = risk, возможность = opportunity, наблюдение = context. summary бери из Главное, answer — из Ответ, risks — из Риск, opportunities — из Возможность, actions — из Стоит проверить. Сохраняй оговорки, убирай технические метки Признаки из пользовательского текста. Не добавляй выводов и цитат, которых нет в ответе агента. Бери только цитаты из ответа агента, не из других результатов инструментов. События с пометкой «пропустить» не включай. Не больше 1-2 цитат и 2-4 claims на событие. Если строки нет — поле опусти, массив оставь пустым. Факты и позиция банка: text целиком является дословной цитатой. Каждый факт ссылается на новость этого события. AI inference требует uncertainty и известный признак из ${featureIds.join(', ')}. Никакого текста вокруг JSON.`,
          ),
        ]
        const invoke = () => model.invoke(messages, config)
        return invokeModel ? invokeModel('structure', invoke, messages) : invoke()
    }
    const scope = {
      configurable: { thread_id: run.id, companyId: run.companyId },
      signal,
      recursionLimit: this.config.AGENT_MAX_STEPS * 3 + 8,
      durability: 'sync' as const,
    }
    const previous = await graph.getState(scope)
    if (previous.values.executionScope && previous.values.executionScope !== executionScope)
      throw new ExecutionError('execution_context_changed')
    const result = await graph.invoke(
      previous.values.executionScope
        ? null
        : {
            executionScope,
            messages: [
              new HumanMessage(
                buildTaskPrompt({
                  mode: isQuestion ? 'question' : 'feed',
                  question,
                  asOf: run.createdAt.slice(0, 10),
                  events: ranked.map((r) => ({
                    id: r.news.id,
                    title: r.news.title,
                    text: r.news.text,
                    publishedAt: r.news.publishedAt,
                    reasons: r.relevance.reasons,
                  })),
                  context: insightContext,
                  conversation,
                }),
              ),
            ],
          },
      scope,
    )
    for (const record of audit)
      await progress('tool.completed', {
        tool: record.tool,
        ok: record.ok,
        durationMs: record.durationMs,
      })
    signal.throwIfAborted()
    if (!result.structured) throw new ExecutionError('checkpoint_incomplete')
    const structured = result.structured
    if (!agentAnswer) {
      const last = result.messages.at(-1)
      agentAnswer = last ? textOf(last) : ''
    }
    const skipped = new Set(
      [...agentAnswer.matchAll(/^Событие\s+([^\s:]+)\s*:\s*пропустить(?:\s|—|-|$)/gimu)].map(
        (match) => match[1],
      ),
    )
    let drafts: EventDraft[] = []
    try {
      drafts = parseDraftBatch(
        JSON.parse(textOf(structured).replace(/^```(?:json)?\s*|\s*```$/g, '')),
      ).filter((draft) => !skipped.has(draft.eventId))
    } catch {
      return {
        insights: [
          {
            ...baseInsight(run, this.catalog),
            limitations: [
              ...context.limitations,
              'Ответ модели не прошёл проверку структурированного формата.',
            ],
          },
        ],
      }
    }
    const insights: Insight[] = []
    const answers: string[] = []
    for (const candidate of ranked) {
      const draft = drafts.find((d) => d.eventId === candidate.news.id)
      if (!draft) continue
      const insight = this.publishDraft(
        run,
        draft,
        candidate,
        result.stopReason ?? 'limit',
        featureIds,
        agentAnswer,
        newsTags.size > 0,
      )
      // Require a verified factual citation to this exact event, not a citation to another ranked news item.
      if (
        !insight.claims.some(
          (c) =>
            c.kind === 'fact' &&
            c.evidenceIds.some((id) =>
              insight.evidence.some((e) => e.id === id && e.documentId === candidate.news.id),
            ),
        )
      )
        continue
      insights.push(insight)
      if (draft.answer) answers.push(draft.answer)
    }
    if (!insights.length && drafts.length) {
      const unavailable = baseInsight(run, this.catalog)
      unavailable.limitations.push('Ни одно событие не прошло проверку связи с первоисточником.')
      insights.push(unavailable)
    }
    insights.forEach((i, index) => {
      i.relevance.rank = index + 1
    })
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      cost: null,
      currency: null,
      certainty: 'unknown' as const,
    }
    for (const message of [...result.messages, structured])
      if (message instanceof AIMessage) {
        usage.inputTokens += message.usage_metadata?.input_tokens ?? 0
        usage.outputTokens += message.usage_metadata?.output_tokens ?? 0
      }
    // Usage describes the entire batch run; attach once to avoid summing it once per insight.
    if (insights[0]) insights[0].usage = usage
    signal.throwIfAborted()
    return run.input.kind === 'question'
      ? {
          insights: [],
          answer:
            drafts.find((d) => d.answer)?.answer ||
            answers.join('\n\n') ||
            'Подтверждённых данных для ответа недостаточно.',
        }
      : { insights }
  }
  private publishDraft(
    run: Run,
    draft: EventDraft,
    candidate: RankedNews,
    stopReason: string,
    featureIds: string[],
    agentAnswer?: string,
    mlRanking = false,
  ): Insight {
    const i = baseInsight(run, this.catalog)
    try {
      const verified = gateDraft(draft, this.ctx, featureIds, agentAnswer)
      i.claims = verified.claims
      i.evidence = verified.evidence
      i.limitations.push(...verified.limitations)
      if (draft.rejectedClaims)
        i.limitations.push('Отдельные утверждения исключены из-за неверного формата.')
      const facts = i.claims.filter((c) => c.kind === 'fact')
      const positions = i.claims.filter((c) => c.kind === 'bank_position')
      const bankEvidence = i.evidence.filter((e) => e.sourceKind === 'bank')
      const dates = [
        ...new Set(bankEvidence.flatMap((e) => (e.publishedAt ? [e.publishedAt] : []))),
      ]
      i.bankPosition = {
        status: positions.length
          ? dates.length && dates.every((d) => Date.now() - Date.parse(d) > 90 * 86400000)
            ? 'stale'
            : 'available'
          : 'missing',
        materialDates: dates,
        claimIds: positions.map((c) => c.id),
      }
      i.event = {
        id: candidate.news.id,
        title: candidate.news.title,
        happenedAt: candidate.news.publishedAt,
        factClaimIds: facts.map((c) => c.id),
      }
      i.status = facts.length ? 'partial' : 'insufficient_evidence'
      if (
        facts.length &&
        positions.length &&
        i.claims.some((c) => c.kind === 'ai_inference' && c.companyFeatureIds.length > 0) &&
        i.bankPosition.status === 'available' &&
        stopReason === 'answered' &&
        !draft.rejectedClaims &&
        !verified.limitations.length
      )
        i.status = 'complete'
      i.summary =
        draft.summary ||
        i.claims
          .map(
            (c) =>
              `${c.kind === 'ai_inference' ? 'Возможное влияние: ' : ''}${c.text}${c.uncertainty ? ` (${c.uncertainty})` : ''}`,
          )
          .join('\n') ||
        i.summary
      i.kind = draft.kind ?? 'context'
      i.risks = draft.risks
      i.opportunities = draft.opportunities
      i.actions = draft.actions
      if (i.summary.length > 6000) {
        i.summary = i.summary.slice(0, 6000)
        i.limitations.push(
          'Краткая сводка сокращена; полные проверенные утверждения доступны в claims.',
        )
      }
      i.relevance = candidate.relevance
      i.limitations.push(
        mlRanking
          ? 'Релевантность рассчитана по разметке новостей моделью и связям компании; совпадение цитаты не доказывает причинную связь.'
          : 'Релевантность рассчитана по явным правилам; совпадение цитаты не доказывает причинную связь.',
      )
    } catch {
      i.limitations.push('Ответ модели не прошёл проверку структурированного формата.')
    }
    return i
  }
}
