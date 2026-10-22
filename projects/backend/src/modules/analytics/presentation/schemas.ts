import { z } from 'zod'
export const perspective = z.enum(['cfo', 'ceo'])
export const scopeQuery = z.object({ perspective: perspective.default('cfo') })
export const idParams = z.object({ id: z.uuid() })
export const companyParams = z.object({ companyId: z.string().min(1).max(100) })
export const pageQuery = scopeQuery.extend({
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export const feedbackSchema = z.object({
  rating: z.enum(['useful', 'not_useful']).nullable(),
  comment: z.string().max(2000),
})
export const userStateSchema = z.object({
  savedAt: z.iso.datetime().nullable(),
  feedback: feedbackSchema,
})
export const runInputSchema = z
  .object({
    companyId: z.string().min(1).max(100),
    perspective,
    kind: z.enum(['refresh_feed', 'question']),
    question: z.string().min(1).max(1000).optional(),
    insightId: z.uuid().optional(),
    insightVersion: z.string().max(100).optional(),
    timeRange: z.object({ since: z.iso.datetime(), until: z.iso.datetime() }).optional(),
  })
  .strict()
export const runSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  companyId: z.string(),
  perspective,
  input: runInputSchema,
  status: z.enum([
    'queued',
    'running',
    'cancelling',
    'completed',
    'partial',
    'failed',
    'cancelled',
  ]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resultIds: z.array(z.string()),
  error: z.string().nullable(),
  sequence: z.number().int(),
  dataMode: z.enum(['fixture', 'research']),
})
export const eventSchema = z.object({
  id: z.string(),
  runId: z.uuid(),
  sequence: z.number().int(),
  at: z.iso.datetime(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
})
export const evidenceSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  sourceKind: z.enum(['news', 'bank']),
  quote: z.string().min(12).max(1000),
  publishedAt: z.string().nullable(),
  page: z.number().int().positive().nullable(),
  verified: z.boolean(),
  contentExtent: z.enum(['full_text', 'lead', 'page']),
})
export const claimSchema = z.object({
  id: z.string(),
  kind: z.enum(['fact', 'bank_position', 'ai_inference']),
  text: z.string().max(4000),
  evidenceIds: z.array(z.string()).max(20),
  companyFeatureIds: z.array(z.string()).max(20),
  uncertainty: z.string().nullable(),
})
export const insightSchema = z.object({
  id: z.uuid(),
  version: z.string(),
  schemaVersion: z.literal('1'),
  companyId: z.string(),
  perspective,
  runId: z.uuid(),
  generatedAt: z.iso.datetime(),
  dataMode: z.enum(['fixture', 'research']),
  profileVersion: z.string(),
  corpusVersion: z.string(),
  status: z.enum(['complete', 'partial', 'insufficient_evidence']),
  kind: z.enum(['risk', 'opportunity', 'context']),
  event: z.object({
    id: z.string(),
    title: z.string().max(300),
    happenedAt: z.string().nullable(),
    factClaimIds: z.array(z.string()),
  }),
  relevance: z.object({
    score: z.number().min(0).max(1),
    rank: z.number().int().nonnegative(),
    reasons: z.array(z.string()),
  }),
  summary: z.string().max(6000),
  claims: z.array(claimSchema).max(30),
  evidence: z.array(evidenceSchema).max(30),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  actions: z.array(z.string()),
  bankPosition: z.object({
    status: z.enum(['available', 'missing', 'stale', 'conflicting']),
    materialDates: z.array(z.string()),
    claimIds: z.array(z.string()),
  }),
  missingData: z.array(z.string()),
  limitations: z.array(z.string()),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cost: z.string().nullable(),
    currency: z.literal('RUB').nullable(),
    certainty: z.enum(['unknown', 'estimated']),
  }),
})
export const acceptedSchema = z.object({
  runId: z.uuid(),
  status: runSchema.shape.status,
  statusUrl: z.string(),
  eventsUrl: z.string(),
  dataMode: z.enum(['fixture', 'research']),
})
export const messageSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  author: z.enum(['user', 'assistant']),
  text: z.string(),
  at: z.iso.datetime(),
})
