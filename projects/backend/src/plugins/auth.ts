import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AppError, type Principal } from '../shared/kernel/errors.js'
import type { Config } from '../config.js'
import type { Runtime } from '../composition/runtime.js'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { registrationSchema } from '../modules/identity/index.js'
import { z } from 'zod'
const cookieName = 'alfa_session'
const ttl = 8 * 60 * 60
const principals = new WeakMap<FastifyRequest, Principal>()
export const authRateKey = (req: FastifyRequest) =>
  principals.has(req) ? 'user:' + principals.get(req)!.id : 'ip:' + req.ip
export function principalOf(req: FastifyRequest) {
  const principal = principals.get(req)
  if (!principal) throw new AppError('unauthorized', 'Требуется авторизация')
  return principal
}
export function registerAuth(app: FastifyInstance, config: Config, runtime: Runtime) {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  const stamp = (hash: string) => digest(hash).toString('hex')
  const byToken = (token: string) =>
    config.accounts.find((user) => timingSafeEqual(digest(user.token), digest(token)))
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.NODE_ENV === 'production',
  }
  function checkOrigin(req: FastifyRequest) {
    if (req.headers.origin && req.headers.origin !== new URL(config.CORS_ORIGIN).origin)
      throw new AppError('unauthorized', 'Недопустимый источник запроса')
  }
  const sessionSchema = z.object({ id: z.string(), expiresAt: z.iso.datetime() })
  const accountSchema = z.object({
    id: z.string(),
    username: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    source: z.enum(['dataset', 'custom']),
  })
  function session(reply: FastifyReply, id: string, hash: string) {
    const expires = Date.now() + ttl * 1000
    reply.setCookie(cookieName, JSON.stringify({ id, expires, stamp: stamp(hash) }), {
      ...cookieOptions,
      signed: true,
      maxAge: ttl,
    })
    return { id, expiresAt: new Date(expires).toISOString() }
  }
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/v1/')) return
    if (req.routeOptions.url === '/v1/accounts') return
    if (req.routeOptions.url === '/v1/session' || req.routeOptions.url === '/v1/registrations') {
      if (req.method !== 'GET') checkOrigin(req)
      return
    }
    const header = req.headers.authorization
    if (config.DEV_AUTH && !header && !req.cookies[cookieName]) {
      const principal = { id: 'local-user', companyIds: ['U_1', 'U_3'] }
      principals.set(req, principal)
      await runtime.hydrate(principal)
      return
    }
    let principal: Principal | undefined
    if (header) {
      const user = byToken(header.startsWith('Bearer ') ? header.slice(7) : '')
      if (user) principal = { id: user.id, companyIds: user.companyIds }
    } else if (req.cookies[cookieName]) {
      const signed = req.unsignCookie(req.cookies[cookieName])
      if (signed.valid && signed.value) {
        let claims: { id: string; expires: number; stamp?: string } | undefined
        try {
          claims = z
            .object({ id: z.string(), expires: z.number(), stamp: z.string().optional() })
            .parse(JSON.parse(signed.value))
        } catch {
          /* Invalid cookies are unauthenticated. */
        }
        if (claims && claims.expires > Date.now()) {
          const user = await runtime.principalFor(claims.id)
          if (user && ((user.legacy && !claims.stamp) || claims.stamp === stamp(user.hash)))
            principal = user.principal
        }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOrigin(req)
    }
    if (!principal) throw new AppError('unauthorized', 'Требуется авторизация')
    await runtime.hydrate(principal)
    principals.set(req, principal)
  })
  app.register(async (child) => {
    const api = child.withTypeProvider<ZodTypeProvider>()
    api.get(
      '/v1/accounts',
      {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
        schema: {
          operationId: 'searchAccounts',
          tags: ['workspace'],
          security: [],
          querystring: z.object({ q: z.string().trim().max(80).default('') }),
          response: { 200: z.object({ items: z.array(accountSchema) }) },
        },
      },
      async (req) => ({ items: await runtime.identity.search(req.query.q) }),
    )
    api.post(
      '/v1/session',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: {
          operationId: 'createSession',
          tags: ['workspace'],
          security: [],
          body: z.union([
            z.object({ accountId: z.string().min(1).max(100) }).strict(),
            z.object({ token: z.string().min(32).max(4096) }).strict(),
          ]),
          response: { 200: sessionSchema },
        },
      },
      async (req, reply) => {
        if ('token' in req.body) {
          const user = byToken(req.body.token)
          if (!user) throw new AppError('unauthorized', 'Ключ доступа не принят')
          return session(reply, user.id, user.token)
        }
        const user = await runtime.identity.open(req.body.accountId)
        return session(reply, user.id, user.sessionVersion)
      },
    )
    api.post(
      '/v1/registrations',
      {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
        schema: {
          operationId: 'registerUser',
          tags: ['workspace'],
          security: [],
          body: registrationSchema,
          response: { 201: sessionSchema.extend({ companyId: z.string() }) },
        },
      },
      async (req, reply) => {
        const user = await runtime.identity.register(req.body)
        return reply
          .code(201)
          .send({ ...session(reply, user.id, user.sessionVersion), companyId: user.companyIds[0]! })
      },
    )
    api.delete(
      '/v1/session',
      {
        schema: {
          operationId: 'deleteSession',
          tags: ['workspace'],
          security: [],
          response: { 204: z.null() },
        },
      },
      async (_req, reply) => {
        reply.clearCookie(cookieName, cookieOptions)
        return reply.code(204).send(null)
      },
    )
  })
}
