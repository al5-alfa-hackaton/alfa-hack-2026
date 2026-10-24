import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { randomBytes } from 'node:crypto'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { loadConfig, type Config } from './config.js'
import { compose, type Runtime } from './composition/runtime.js'
import { watchNewsRefresh } from './composition/news-refresh.js'
import { AppError } from './shared/kernel/errors.js'
import { transformOpenApi } from './plugins/openapi.js'
import { authRateKey, registerAuth } from './plugins/auth.js'
import { createCompaniesModule } from './modules/companies/companies.module.js'
import { createAnalyticsModule } from './modules/analytics/analytics.module.js'
import { Redis } from 'ioredis'
export async function buildApp(config: Config = loadConfig(), deps?: Runtime) {
  const runtime = deps ?? (await compose(config))
  const app = Fastify({
    bodyLimit: 32768,
    requestTimeout: 30000,
    logger: {
      level: config.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.token',
        '*.apiKey',
        '*.password',
        '*.passwordHash',
      ],
    },
  })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  const errorSchema = z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryable: z.boolean(),
    resetAt: z.iso.datetime().optional(),
  })
  app.register(cors, {
    origin: config.CORS_ORIGIN,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Last-Event-ID'],
  })
  app.register(helmet)
  app.register(cookie, {
    secret: config.AUTH_SESSION_SECRET ?? randomBytes(32).toString('hex'),
  })
  app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    hook: 'preHandler',
    keyGenerator: authRateKey,
  })
  app.register(swagger, {
    openapi: {
      info: { title: 'Alfa News Analytics API', version: '1.0.0' },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
          browserSession: { type: 'apiKey', in: 'cookie', name: 'alfa_session' },
        },
      },
      security: [{ bearerAuth: [] }, { browserSession: [] }],
    },
    transform: jsonSchemaTransform,
    transformObject: transformOpenApi,
  })
  app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { persistAuthorization: false } })
  app.addHook('onRoute', (opts) => {
    if (opts.url.startsWith('/v1/'))
      opts.schema = {
        ...opts.schema,
        response: {
          ...(opts.schema?.response as Record<string, unknown> | undefined),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
          429: errorSchema,
          500: errorSchema,
          503: errorSchema,
        },
      }
  })
  registerAuth(app, config, runtime)
  app.addHook('onSend', async (req, reply, payload) => {
    if (req.url.startsWith('/v1/')) reply.header('Cache-Control', 'private, no-store')
    return payload
  })
  app.setErrorHandler((error, req, reply) => {
    const codes: Record<string, number> = {
      unauthorized: 401,
      not_found: 404,
      invalid_request: 400,
      idempotency_conflict: 409,
      version_conflict: 409,
      username_taken: 409,
      already_terminal: 409,
      budget_exhausted: 429,
      unavailable: 503,
    }
    const err = error as Error & { validation?: unknown; statusCode?: number; code?: string }
    const expected = error instanceof AppError
    const status = expected
      ? (codes[error.code] ?? 400)
      : err.validation
        ? 400
        : err.statusCode === 429
          ? 429
          : 500
    if (status >= 500)
      req.log.error(
        { errorName: err.name, errorCode: expected ? error.code : 'internal_error' },
        'Request failed',
      )
    return reply.code(status).send({
      code: expected
        ? error.code
        : status === 400
          ? 'invalid_request'
          : status === 429
            ? 'rate_limited'
            : 'internal_error',
      message: expected
        ? error.message
        : status === 400
          ? 'Проверьте параметры запроса'
          : status === 429
            ? 'Слишком много запросов'
            : 'Внутренняя ошибка сервера',
      requestId: req.id,
      retryable: expected ? error.retryable : status >= 500,
      ...(expected && error.resetAt ? { resetAt: error.resetAt } : {}),
    })
  })
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      code: 'route_not_found',
      message: 'Маршрут не найден',
      requestId: req.id,
      retryable: false,
    }),
  )
  app.get('/health', async () => ({ status: 'ok', service: 'backend' }))
  let redis: Redis | undefined
  app.get('/ready', async (_req, reply) => {
    if (!runtime.database)
      return reply.code(503).send({ status: 'unavailable', database: 'not_configured' })
    try {
      await runtime.database.db.execute(
        sql`select 1 from analysis_runs, agent_model_calls, agent_checkpoints.checkpoints, users, company_memberships, custom_companies limit 0`,
      )
      if (!redis) {
        redis = new Redis(config.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          retryStrategy: () => null,
          connectTimeout: 2000,
        })
        redis.on('error', () => {})
      }
      if (redis.status === 'wait' || redis.status === 'end') await redis.connect()
      await redis.ping()
      return { status: 'ok', database: 'ok', queue: 'ok' }
    } catch {
      return reply.code(503).send({ status: 'unavailable', database: 'check_dependencies' })
    }
  })
  app.register(createCompaniesModule(runtime.catalog), { prefix: '/v1' })
  app.register(createAnalyticsModule(runtime.analytics, runtime.documents), { prefix: '/v1' })
  const stopWatching = deps
    ? () => {}
    : watchNewsRefresh(config, runtime.data, (message) => app.log.info(message))
  app.addHook('onClose', async () => {
    stopWatching()
    redis?.disconnect()
    if (!deps) await runtime.database?.pool.end()
  })
  return app
}
