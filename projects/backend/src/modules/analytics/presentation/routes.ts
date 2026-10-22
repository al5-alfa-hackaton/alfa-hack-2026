import type { FastifyPluginAsync } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { setTimeout as delay } from 'node:timers/promises'
import { principalOf } from '../../../plugins/auth.js'
import { AppError } from '../../../shared/kernel/errors.js'
import type { Analytics } from '../application/analytics.js'
import type { Documents } from '../application/documents.js'
import { terminal, type Run } from '../domain/model.js'
import * as s from './schemas.js'
function accepted(run: Run) {
  return {
    runId: run.id,
    status: run.status,
    statusUrl: `/v1/analysis-runs/${run.id}`,
    eventsUrl: `/v1/analysis-runs/${run.id}/events`,
    dataMode: run.dataMode,
  }
}
const keyHeaders = z.object({ 'idempotency-key': z.string().min(8).max(200) })
const versionScope = s.scopeQuery.extend({ version: z.string().min(1).max(100) })
function page<T extends { id: string }>(items: T[], cursor: string | undefined, limit: number) {
  const start = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0
  if (cursor && start === 0) throw new AppError('invalid_request', 'Курсор недействителен')
  const data = items.slice(start, start + limit)
  return { items: data, nextCursor: start + limit < items.length ? data.at(-1)!.id : null }
}
export function createAnalyticsRoutes(
  service: Analytics,
  documents: Documents,
): FastifyPluginAsync {
  return async (app) => {
    const api = app.withTypeProvider<ZodTypeProvider>()
    const streams = new Set<AbortController>()
    app.addHook('preClose', async () => {
      for (const stream of streams) stream.abort()
    })
    api.get(
      '/me',
      {
        schema: {
          operationId: 'currentUser',
          tags: ['workspace'],
          response: {
            200: z.object({
              id: z.string(),
              companyIds: z.array(z.string()),
              perspectives: z.array(s.perspective),
            }),
          },
        },
      },
      async (req) => ({
        id: principalOf(req).id,
        companyIds: [...principalOf(req).companyIds],
        perspectives: ['cfo' as const, 'ceo' as const],
      }),
    )
    api.post(
      '/analysis-runs',
      {
        schema: {
          operationId: 'startAnalysis',
          tags: ['runs'],
          headers: keyHeaders,
          body: s.runInputSchema,
          response: { 202: s.acceptedSchema },
        },
      },
      async (req, reply) =>
        reply
          .code(202)
          .send(
            accepted(
              await service.start(principalOf(req), req.body, req.headers['idempotency-key']),
            ),
          ),
    )
    api.get(
      '/analysis-runs/:id',
      {
        schema: {
          operationId: 'getRun',
          tags: ['runs'],
          params: s.idParams,
          response: { 200: s.runSchema },
        },
      },
      async (req) => service.store.run(principalOf(req), req.params.id),
    )
    api.post(
      '/analysis-runs/:id/cancel',
      {
        schema: {
          operationId: 'cancelRun',
          tags: ['runs'],
          params: s.idParams,
          response: { 200: s.runSchema, 202: s.runSchema },
        },
      },
      async (req, reply) => {
        const run = await service.store.cancel(principalOf(req), req.params.id)
        return reply.code(run.status === 'cancelling' ? 202 : 200).send(run)
      },
    )
    api.get(
      '/analysis-runs/:id/events',
      {
        schema: {
          operationId: 'runEvents',
          tags: ['runs'],
          description:
            'SSE: id = runId:sequence. Reconnect with Last-Event-ID or after. Polling fallback: getRun. Events are persisted; heartbeat does not imply progress.',
          params: s.idParams,
          querystring: z.object({ after: z.coerce.number().int().min(0).default(0) }),
          response: { 200: z.string() },
        },
      },
      async (req, reply) => {
        const p = principalOf(req),
          id = req.params.id
        const run = await service.store.run(p, id)
        const header = req.headers['last-event-id']
        let after = req.query.after
        if (header) {
          if (
            typeof header !== 'string' ||
            !header.startsWith(`${id}:`) ||
            !/^\d+$/.test(header.slice(id.length + 1))
          )
            throw new AppError('invalid_request', 'Last-Event-ID недействителен')
          after = Number(header.slice(id.length + 1))
        }
        if (!Number.isSafeInteger(after) || after > run.sequence)
          throw new AppError('invalid_request', 'Курсор событий недействителен')
        const abort = new AbortController()
        streams.add(abort)
        reply.hijack()
        for (const [name, value] of Object.entries(reply.getHeaders()))
          if (value !== undefined) reply.raw.setHeader(name, value as string)
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        })
        reply.raw.on('close', () => abort.abort())
        let heartbeat = Date.now()
        try {
          while (!abort.signal.aborted) {
            for (const e of await service.store.events(p, id, after)) {
              reply.raw.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
              after = e.sequence
            }
            const current = await service.store.run(p, id)
            if (terminal(current.status) && after >= current.sequence) break
            if (Date.now() - heartbeat >= 15000) {
              reply.raw.write(': heartbeat\n\n')
              heartbeat = Date.now()
            }
            await delay(250, undefined, { signal: abort.signal })
          }
        } catch (error) {
          if (!abort.signal.aborted)
            req.log.error(
              { errorName: error instanceof Error ? error.name : 'Error' },
              'SSE disconnected',
            )
        } finally {
          streams.delete(abort)
          reply.raw.end()
        }
      },
    )
    api.get(
      '/companies/:companyId/analysis-runs',
      {
        schema: {
          operationId: 'runHistory',
          tags: ['runs'],
          params: s.companyParams,
          querystring: s.pageQuery,
          response: {
            200: z.object({ items: z.array(s.runSchema), nextCursor: z.string().nullable() }),
          },
        },
      },
      async (req) => {
        const items = await service.store.history(
          principalOf(req),
          req.params.companyId,
          req.query.perspective,
        )
        return page(items, req.query.cursor, req.query.limit)
      },
    )
    api.get(
      '/companies/:companyId/insights',
      {
        schema: {
          operationId: 'listInsights',
          tags: ['insights'],
          params: s.companyParams,
          querystring: s.pageQuery.extend({
            kind: z.enum(['all', 'risk', 'opportunity', 'context']).default('all'),
            q: z.string().max(200).default(''),
          }),
          response: {
            200: z.object({
              items: z.array(s.insightSchema),
              nextCursor: z.string().nullable(),
              matchedCount: z.number().int(),
              counts: z.object({
                all: z.number().int(),
                risk: z.number().int(),
                opportunity: z.number().int(),
                context: z.number().int(),
              }),
              version: z.string().nullable(),
              dataMode: z.enum(['fixture', 'research']).nullable(),
              limitations: z.array(z.string()),
            }),
          },
        },
      },
      async (req) => {
        const all = await service.feed(
          principalOf(req),
          req.params.companyId,
          req.query.perspective,
        )
        const searched = all.filter((i) =>
          `${i.event.title} ${i.summary}`
            .toLocaleLowerCase()
            .includes(req.query.q.toLocaleLowerCase()),
        )
        const filtered = searched.filter(
          (i) => req.query.kind === 'all' || i.kind === req.query.kind,
        )
        return {
          ...page(filtered, req.query.cursor, req.query.limit),
          matchedCount: filtered.length,
          counts: {
            all: searched.length,
            risk: searched.filter((i) => i.kind === 'risk').length,
            opportunity: searched.filter((i) => i.kind === 'opportunity').length,
            context: searched.filter((i) => i.kind === 'context').length,
          },
          version: all[0]?.version ?? null,
          dataMode: all[0]?.dataMode ?? null,
          limitations: all.length ? [] : ['Сводка ещё не сформирована.'],
        }
      },
    )
    api.get(
      '/insights/:id',
      {
        schema: {
          operationId: 'getInsight',
          tags: ['insights'],
          params: s.idParams,
          querystring: s.scopeQuery,
          response: { 200: z.object({ insight: s.insightSchema, userState: s.userStateSchema }) },
        },
      },
      async (req) => {
        const p = principalOf(req),
          insight = await service.detail(p, req.params.id, req.query.perspective)
        return { insight, userState: await service.store.userState(p, insight) }
      },
    )
    api.get(
      '/companies/:companyId/saved-insights',
      {
        schema: {
          operationId: 'savedInsights',
          tags: ['workspace'],
          params: s.companyParams,
          querystring: s.pageQuery,
          response: {
            200: z.object({ items: z.array(s.insightSchema), nextCursor: z.string().nullable() }),
          },
        },
      },
      async (req) => {
        const p = principalOf(req)
        await service.feed(p, req.params.companyId, req.query.perspective)
        return page(
          await service.store.savedInsights(p, req.params.companyId, req.query.perspective),
          req.query.cursor,
          req.query.limit,
        )
      },
    )
    api.put(
      '/me/saved-insights/:id',
      {
        schema: {
          operationId: 'saveInsight',
          tags: ['workspace'],
          params: s.idParams,
          body: versionScope,
          response: { 200: s.userStateSchema },
        },
      },
      async (req) =>
        service.state(principalOf(req), req.params.id, req.body.perspective, req.body.version, {
          saved: true,
        }),
    )
    api.delete(
      '/me/saved-insights/:id',
      {
        schema: {
          operationId: 'unsaveInsight',
          tags: ['workspace'],
          params: s.idParams,
          querystring: versionScope,
          response: { 204: z.null() },
        },
      },
      async (req, reply) => {
        await service.state(
          principalOf(req),
          req.params.id,
          req.query.perspective,
          req.query.version,
          { saved: false },
        )
        return reply.code(204).send(null)
      },
    )
    api.put(
      '/insights/:id/feedback',
      {
        schema: {
          operationId: 'updateFeedback',
          tags: ['workspace'],
          params: s.idParams,
          body: versionScope.merge(s.feedbackSchema),
          response: { 200: s.userStateSchema },
        },
      },
      async (req) =>
        service.state(principalOf(req), req.params.id, req.body.perspective, req.body.version, {
          feedback: { rating: req.body.rating, comment: req.body.comment },
        }),
    )
    api.get(
      '/insights/:id/conversation',
      {
        schema: {
          operationId: 'getConversation',
          tags: ['questions'],
          params: s.idParams,
          querystring: s.scopeQuery,
          response: {
            200: z.object({
              conversationId: z.string(),
              version: z.string(),
              items: z.array(s.messageSchema),
            }),
          },
        },
      },
      async (req) => {
        const p = principalOf(req),
          i = await service.detail(p, req.params.id, req.query.perspective)
        return {
          conversationId: `${p.id}:${i.id}:${i.version}`,
          version: i.version,
          items: await service.store.messages(p, i),
        }
      },
    )
    api.post(
      '/insights/:id/questions',
      {
        schema: {
          operationId: 'askQuestion',
          tags: ['questions'],
          params: s.idParams,
          headers: keyHeaders,
          body: z.object({
            perspective: s.perspective,
            insightVersion: z.string().min(1).max(100),
            question: z.string().trim().min(1).max(1000),
          }),
          response: { 202: s.acceptedSchema.extend({ conversationId: z.string() }) },
        },
      },
      async (req, reply) => {
        const p = principalOf(req),
          i = await service.detail(p, req.params.id, req.body.perspective)
        const run = await service.start(
          p,
          { companyId: i.companyId, kind: 'question', insightId: i.id, ...req.body },
          req.headers['idempotency-key'],
        )
        return reply
          .code(202)
          .send({ ...accepted(run), conversationId: `${p.id}:${i.id}:${i.version}` })
      },
    )
    api.get(
      '/insights/:id/trace',
      {
        schema: {
          operationId: 'insightTrace',
          tags: ['insights'],
          params: s.idParams,
          querystring: s.scopeQuery,
          response: { 200: z.object({ items: z.array(s.eventSchema) }) },
        },
      },
      async (req) => {
        const p = principalOf(req),
          i = await service.detail(p, req.params.id, req.query.perspective)
        return { items: await service.store.trace(p, i) }
      },
    )
    const docParams = z.object({ documentId: z.string().regex(/^[\w-]{1,100}$/) })
    api.get(
      '/documents/:documentId',
      {
        schema: {
          operationId: 'readDocument',
          tags: ['documents'],
          params: docParams,
          querystring: z.object({
            page: z.coerce.number().int().min(1).max(10000).default(1),
            offset: z.coerce.number().int().min(0).max(1000000).default(0),
            length: z.coerce.number().int().min(1).max(4000).default(2000),
          }),
          response: {
            200: z.object({
              documentId: z.string(),
              title: z.string(),
              publishedAt: z.string().nullable(),
              sourceKind: z.enum(['news', 'bank']),
              contentExtent: z.enum(['page', 'lead']),
              page: z.number().int(),
              offset: z.number().int(),
              totalLength: z.number().int(),
              text: z.string(),
              externalUrl: z.string().nullable(),
            }),
          },
        },
      },
      async (req) =>
        documents.read(
          principalOf(req),
          req.params.documentId,
          req.query.page,
          req.query.offset,
          req.query.length,
        ),
    )
    api.get(
      '/documents/:documentId/pages/:pageNumber/image',
      {
        schema: {
          operationId: 'documentImage',
          tags: ['documents'],
          params: docParams.extend({ pageNumber: z.coerce.number().int().min(1).max(10000) }),
          response: { 200: z.string().describe('PNG bytes; Content-Type: image/png') },
        },
      },
      async (req, reply) => {
        const image = await documents.image(
          principalOf(req),
          req.params.documentId,
          req.params.pageNumber,
        )
        reply.hijack()
        reply.raw.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=300',
        })
        reply.raw.end(image)
      },
    )
  }
}
