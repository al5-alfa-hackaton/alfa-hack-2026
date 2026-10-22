import { z } from 'zod'
import { MAX_RANKING_LIMIT } from '../domain/ranking.js'

const claimSchema = z.object({
  kind: z.enum(['fact', 'bank_position', 'ai_inference']),
  text: z.string().min(1).max(2000),
  companyFeatureIds: z.array(z.string()).max(10),
  uncertainty: z.string().nullable(),
  citations: z
    .array(z.object({ documentId: z.string(), quote: z.string().min(12).max(300) }))
    .max(10),
})
const listSchema = z.array(z.string().trim().min(1).max(2000)).max(10)
const eventSchema = z.object({
  eventId: z.string().min(1).max(200),
  claims: z.array(z.unknown()),
  summary: z.string().trim().min(1).max(6000).optional().catch(undefined),
  kind: z.enum(['risk', 'opportunity', 'context']).optional().catch(undefined),
  answer: z.string().trim().min(1).max(6000).optional().catch(undefined),
  risks: listSchema.catch([]),
  opportunities: listSchema.catch([]),
  actions: listSchema.catch([]),
})
export type DraftClaim = z.infer<typeof claimSchema>
export type EventDraft = Omit<z.infer<typeof eventSchema>, 'claims'> & {
  claims: DraftClaim[]
  rejectedClaims: number
}

export function parseDraftBatch(value: unknown): EventDraft[] {
  const batch = z.object({ events: z.array(z.unknown()).max(MAX_RANKING_LIMIT) }).parse(value)
  return batch.events.flatMap((event) => {
    const parsed = eventSchema.safeParse(event)
    if (!parsed.success) return []
    const claims = parsed.data.claims.slice(0, 15).flatMap((claim) => {
      const parsedClaim = claimSchema.safeParse(claim)
      return parsedClaim.success ? [parsedClaim.data] : []
    })
    return [{ ...parsed.data, claims, rejectedClaims: parsed.data.claims.length - claims.length }]
  })
}
