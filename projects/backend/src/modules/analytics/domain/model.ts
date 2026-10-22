export type Perspective = 'cfo' | 'ceo'
export type DataMode = 'fixture' | 'research'
export type RunStatus =
  'queued' | 'running' | 'cancelling' | 'completed' | 'partial' | 'failed' | 'cancelled'
export const terminal = (status: RunStatus) =>
  ['completed', 'partial', 'failed', 'cancelled'].includes(status)
export type RunInput = {
  companyId: string
  perspective: Perspective
  kind: 'refresh_feed' | 'question'
  question?: string
  insightId?: string
  insightVersion?: string
  timeRange?: { since: string; until: string }
}
export type Run = {
  id: string
  userId: string
  companyId: string
  perspective: Perspective
  input: RunInput
  status: RunStatus
  createdAt: string
  updatedAt: string
  resultIds: string[]
  error: string | null
  sequence: number
  dataMode: DataMode
}
export type RunEvent = {
  id: string
  runId: string
  sequence: number
  at: string
  type: string
  payload: Record<string, unknown>
}
export type Evidence = {
  id: string
  documentId: string
  sourceKind: 'news' | 'bank'
  quote: string
  publishedAt: string | null
  page: number | null
  verified: boolean
  contentExtent: 'full_text' | 'lead' | 'page'
}
export type Claim = {
  id: string
  kind: 'fact' | 'bank_position' | 'ai_inference'
  text: string
  evidenceIds: string[]
  companyFeatureIds: string[]
  uncertainty: string | null
}
export type Insight = {
  id: string
  version: string
  schemaVersion: '1'
  companyId: string
  perspective: Perspective
  runId: string
  generatedAt: string
  dataMode: DataMode
  profileVersion: string
  corpusVersion: string
  status: 'complete' | 'partial' | 'insufficient_evidence'
  kind: 'risk' | 'opportunity' | 'context'
  event: { id: string; title: string; happenedAt: string | null; factClaimIds: string[] }
  relevance: { score: number; rank: number; reasons: string[] }
  summary: string
  claims: Claim[]
  evidence: Evidence[]
  risks: string[]
  opportunities: string[]
  actions: string[]
  bankPosition: {
    status: 'available' | 'missing' | 'stale' | 'conflicting'
    materialDates: string[]
    claimIds: string[]
  }
  missingData: string[]
  limitations: string[]
  usage: {
    inputTokens: number
    outputTokens: number
    cost: string | null
    currency: 'RUB' | null
    certainty: 'unknown' | 'estimated'
  }
}
export type Feedback = { rating: 'useful' | 'not_useful' | null; comment: string }
export type UserState = { savedAt: string | null; feedback: Feedback }
export type Message = {
  id: string
  runId: string
  author: 'user' | 'assistant'
  text: string
  at: string
}
