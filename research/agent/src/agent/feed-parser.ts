import { AIMessage, type BaseMessage } from '@langchain/core/messages'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { DataContext } from '../data/context.js'
import { evidenceVerify } from '../tools/functions.js'
import { textOf, type AgentState } from './graph.js'

export type DraftCitation = { documentId: string; quote: string }
export type DraftClaim = {
  kind: 'fact' | 'bank_position' | 'ai_inference'
  text: string
  companyFeatureIds: string[]
  uncertainty: string | null
  citations: DraftCitation[]
}
export type FeedNote = { text: string; companyFeatureIds: string[]; uncertainty: string | null }
export type InsightKind = 'risk' | 'opportunity' | 'context'
export type ParsedEvent = {
  eventId: string
  kind: InsightKind
  summary: string | null
  answer: string | null
  claims: DraftClaim[]
  risks: FeedNote[]
  opportunities: FeedNote[]
  actions: FeedNote[]
}
export type FeedParseResult = {
  events: ParsedEvent[]
  skipped: { eventId: string; reason: string }[]
  issues: string[]
}
export type FeedParseOptions = { ctx?: DataContext; eventIds?: string[]; featureIds?: string[] }

const QUOTE_MIN = 12
const QUOTE_MAX = 300
const MAX_CLAIMS = 15
const MAX_TEXT = 2000

const LABELS = {
  ответ: 'answer',
  тип: 'type',
  главное: 'main',
  факт: 'fact',
  'позиция банка': 'bank',
  вывод: 'inference',
  риск: 'risk',
  возможность: 'opportunity',
  'стоит проверить': 'action',
} as const
type Label = (typeof LABELS)[keyof typeof LABELS]

const KIND_BY_WORD: Record<string, InsightKind> = { риск: 'risk', возможность: 'opportunity', наблюдение: 'context' }

const EVENT_HEADER = /^событие\s+((?:news|bank)_[0-9a-z]+)\s*(?::\s*пропустить\s*(?:[—–-]\s*(.*))?)?$/i
const LABEL_LINE = new RegExp(`^(${Object.keys(LABELS).join('|')})\\s*:\\s*(.*)$`, 'i')
const CITATION_TAIL = /\[\s*((?:news|bank)_[0-9a-z]+)\s*(?:,[^\]]*)?\]\s*\.?\s*$/i

function cleanLine(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .trim()
}

function stripQuotes(text: string): string {
  const t = text.trim()
  if ((t.startsWith('«') && t.endsWith('»')) || (t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”')))
    return t.slice(1, -1).trim()
  return t
}

function fitQuote(quote: string): string | null {
  if (quote.length <= QUOTE_MAX) return quote.length >= QUOTE_MIN ? quote : null
  const head = quote.slice(0, QUOTE_MAX)
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '))
  const trimmed = (cut >= QUOTE_MIN ? head.slice(0, cut + 1) : head.slice(0, head.lastIndexOf(' '))).trim()
  return trimmed.length >= QUOTE_MIN ? trimmed : null
}

function splitNote(body: string): FeedNote {
  const features = /\s*Признаки\s*:\s*/i
  const caveat = /\s*Оговорка\s*:\s*/i
  let text = body
  let featurePart = ''
  let uncertainty: string | null = null
  const c = text.search(caveat)
  if (c >= 0) {
    uncertainty = text.slice(c).replace(caveat, '').trim().replace(/\.$/, '') || null
    text = text.slice(0, c)
  }
  const f = text.search(features)
  if (f >= 0) {
    featurePart = text.slice(f).replace(features, '')
    text = text.slice(0, f)
  }
  const companyFeatureIds = [...new Set(featurePart.split(/[\s,;.]+/).filter((id) => /^[a-z_]+$/.test(id)))]
  return { text: text.trim().replace(/\s*\.$/, '.').slice(0, MAX_TEXT), companyFeatureIds, uncertainty }
}

type Draft = {
  eventId: string
  kindWord: string | null
  main: FeedNote | null
  answer: FeedNote | null
  facts: DraftCitation[]
  bank: DraftCitation[]
  inferences: FeedNote[]
  risks: FeedNote[]
  opportunities: FeedNote[]
  actions: FeedNote[]
}

function emptyDraft(eventId: string): Draft {
  return { eventId, kindWord: null, main: null, answer: null, facts: [], bank: [], inferences: [], risks: [], opportunities: [], actions: [] }
}

function readCitation(body: string, eventId: string, label: 'fact' | 'bank', issues: string[], opts: FeedParseOptions): DraftCitation | null {
  const tail = body.match(CITATION_TAIL)
  if (!tail) {
    issues.push(`${eventId}: ${label === 'fact' ? 'факт' : 'позиция банка'} без идентификатора документа`)
    return null
  }
  const documentId = tail[1]!
  if (label === 'bank' && !documentId.startsWith('bank_')) {
    issues.push(`${eventId}: позиция банка ссылается не на материал банка (${documentId})`)
    return null
  }
  const raw = stripQuotes(body.slice(0, tail.index).trim())
  const quote = fitQuote(raw)
  if (!quote) {
    issues.push(`${eventId}: цитата короче ${QUOTE_MIN} символов`)
    return null
  }
  if (quote !== raw) issues.push(`${eventId}: цитата длиннее ${QUOTE_MAX} символов сокращена по границе предложения`)
  if (opts.ctx && !evidenceVerify(opts.ctx, [{ documentId, quote }])[0]?.verified) {
    issues.push(`${eventId}: цитата не найдена в документе ${documentId}`)
    return null
  }
  return { documentId, quote }
}

function keepFeatures(note: FeedNote, eventId: string, issues: string[], opts: FeedParseOptions): FeedNote {
  if (!opts.featureIds) return note
  const allowed = note.companyFeatureIds.filter((id) => opts.featureIds!.includes(id))
  const dropped = note.companyFeatureIds.filter((id) => !opts.featureIds!.includes(id))
  if (dropped.length) issues.push(`${eventId}: признаки ${dropped.join(', ')} неизвестны и убраны`)
  return { ...note, companyFeatureIds: allowed }
}

function inferenceClaim(note: FeedNote, eventId: string, issues: string[]): DraftClaim | null {
  if (!note.text) return null
  if (!note.companyFeatureIds.length || !note.uncertainty) {
    issues.push(`${eventId}: вывод без признака компании или оговорки не попадет в утверждения`)
    return null
  }
  return { kind: 'ai_inference', text: note.text, companyFeatureIds: note.companyFeatureIds.slice(0, 10), uncertainty: note.uncertainty, citations: [] }
}

function toEvent(d: Draft, issues: string[], opts: FeedParseOptions): ParsedEvent {
  const notes = (list: FeedNote[]) => list.map((n) => keepFeatures(n, d.eventId, issues, opts)).filter((n) => n.text)
  const main = d.main ? keepFeatures(d.main, d.eventId, issues, opts) : null
  const answer = d.answer ? keepFeatures(d.answer, d.eventId, issues, opts) : null
  const inferences = notes(d.inferences)
  const claims: DraftClaim[] = [
    ...d.facts.map((c) => ({ kind: 'fact' as const, text: c.quote, companyFeatureIds: [], uncertainty: null, citations: [c] })),
    ...d.bank.map((c) => ({ kind: 'bank_position' as const, text: c.quote, companyFeatureIds: [], uncertainty: null, citations: [c] })),
    ...[answer, main, ...inferences].flatMap((n) => (n ? [inferenceClaim(n, d.eventId, issues)] : [])).filter((c): c is DraftClaim => c !== null),
  ]
  const risks = notes(d.risks)
  const opportunities = notes(d.opportunities)
  const declared = d.kindWord ? KIND_BY_WORD[d.kindWord.toLowerCase().replace(/[^а-я]/g, '')] : undefined
  const kind: InsightKind = declared ?? (risks.length && !opportunities.length ? 'risk' : opportunities.length && !risks.length ? 'opportunity' : 'context')
  if (!d.facts.length) issues.push(`${d.eventId}: нет подтвержденного факта из новости — карточка не будет опубликована`)
  return {
    eventId: d.eventId,
    kind,
    summary: main?.text || null,
    answer: answer?.text || null,
    claims: claims.slice(0, MAX_CLAIMS),
    risks,
    opportunities,
    actions: notes(d.actions),
  }
}

export function parseFeedAnswer(text: string, opts: FeedParseOptions = {}): FeedParseResult {
  const issues: string[] = []
  const skipped: FeedParseResult['skipped'] = []
  const drafts: Draft[] = []
  let current: Draft | null = null

  for (const rawLine of text.split('\n')) {
    const line = cleanLine(rawLine)
    if (!line) continue
    const header = line.match(EVENT_HEADER)
    if (header) {
      const eventId = header[1]!
      current = null
      if (opts.eventIds && !opts.eventIds.includes(eventId)) {
        issues.push(`${eventId}: событие не из выбранных сервером, пропущено`)
        continue
      }
      if (/пропустить/i.test(line)) {
        skipped.push({ eventId, reason: (header[2] ?? '').trim().replace(/\.$/, '') })
        continue
      }
      current = drafts.find((d) => d.eventId === eventId) ?? emptyDraft(eventId)
      if (!drafts.includes(current)) drafts.push(current)
      continue
    }
    const labelled = line.match(LABEL_LINE)
    if (!current || !labelled) continue
    const label: Label = LABELS[labelled[1]!.toLowerCase() as keyof typeof LABELS]
    const body = labelled[2]!.trim()
    if (!body) continue
    switch (label) {
      case 'type':
        current.kindWord = body
        break
      case 'fact':
      case 'bank': {
        const citation = readCitation(body, current.eventId, label, issues, opts)
        if (citation) (label === 'fact' ? current.facts : current.bank).push(citation)
        break
      }
      case 'main':
        current.main = splitNote(body)
        break
      case 'answer':
        current.answer = splitNote(body)
        break
      case 'inference':
        current.inferences.push(splitNote(body))
        break
      case 'risk':
        current.risks.push(splitNote(body))
        break
      case 'opportunity':
        current.opportunities.push(splitNote(body))
        break
      case 'action':
        current.actions.push(splitNote(body))
        break
    }
  }

  const skippedIds = new Set(skipped.map((s) => s.eventId))
  return { events: drafts.filter((d) => !skippedIds.has(d.eventId)).map((d) => toEvent(d, issues, opts)), skipped, issues }
}

export function toStructuredDraft(result: FeedParseResult) {
  return { events: result.events.slice(0, 5), skipped: result.skipped, issues: result.issues }
}

function finalAnswer(state: AgentState): string {
  const last = [...state.messages].reverse().find((m) => m instanceof AIMessage && !m.tool_calls?.length)
  return last ? textOf(last) : ''
}

export function createFeedFinalizer(opts: {
  ctx: DataContext
  eventIds: string[]
  featureIds: string[]
  fallback?: (state: AgentState, config: RunnableConfig) => Promise<BaseMessage>
}) {
  return async (state: AgentState, config: RunnableConfig): Promise<BaseMessage> => {
    const result = parseFeedAnswer(finalAnswer(state), opts)
    if (!result.events.length && !result.skipped.length && opts.fallback) return opts.fallback(state, config)
    return new AIMessage({ content: JSON.stringify(toStructuredDraft(result)) })
  }
}
