import type { FastifyPluginAsync } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { Companies, type CompanyCatalog } from '../application/catalog.js'
import { principalOf } from '../../../plugins/auth.js'
export const companySummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  industry: z.string().nullable(),
  region: z.string().nullable(),
})
export const companyContextSchema = z.object({
  company: companySummarySchema,
  profileVersion: z.string(),
  profileSource: z.enum(['dataset', 'user']).optional(),
  corpusVersion: z.string(),
  dataMode: z.enum(['fixture', 'research']),
  features: z.array(z.object({ id: z.string(), label: z.string(), value: z.string().nullable() })),
  gaps: z.array(z.string()),
  limitations: z.array(z.string()),
})
export function createCompaniesModule(catalog: CompanyCatalog): FastifyPluginAsync {
  const service = new Companies(catalog)
  return async (app) => {
    const api = app.withTypeProvider<ZodTypeProvider>()
    api.get(
      '/companies',
      {
        schema: {
          operationId: 'listCompanies',
          tags: ['companies'],
          querystring: z.object({
            query: z.string().max(100).default(''),
            cursor: z.string().optional(),
            limit: z.coerce.number().int().min(1).max(100).default(20),
          }),
          response: {
            200: z.object({
              items: z.array(companySummarySchema),
              nextCursor: z.string().nullable(),
            }),
          },
        },
      },
      async (req) => {
        const items = service
          .list(principalOf(req), req.query.query)
          .sort((a, b) => a.id.localeCompare(b.id))
        const filtered = req.query.cursor ? items.filter((i) => i.id > req.query.cursor!) : items
        const page = filtered.slice(0, req.query.limit)
        return { items: page, nextCursor: filtered.length > page.length ? page.at(-1)!.id : null }
      },
    )
    api.get(
      '/companies/:companyId/context',
      {
        schema: {
          operationId: 'companyContext',
          tags: ['companies'],
          params: z.object({ companyId: z.string().min(1).max(100) }),
          response: { 200: companyContextSchema },
        },
      },
      async (req) => service.context(principalOf(req), req.params.companyId),
    )
  }
}
