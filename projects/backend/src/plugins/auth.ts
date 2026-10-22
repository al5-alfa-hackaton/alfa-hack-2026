import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { AppError, type Principal } from '../shared/kernel/errors.js'
import type { Config } from '../config.js'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
const cookieName = 'alfa_session'
const ttl = 8 * 60 * 60
const principals = new WeakMap<FastifyRequest, Principal>()
export const authRateKey = (req: FastifyRequest) => principals.get(req)?.id ?? req.ip
export function principalOf(req: FastifyRequest) {
  const p = principals.get(req)
  if (!p) throw new AppError('unauthorized', 'Требуется авторизация')
  return p
}
export function registerAuth(app: FastifyInstance, config: Config) {
  const users = config.accounts
  if (config.NODE_ENV === 'production' && !users.length)
    throw new Error('AUTH_USERS_JSON must contain service accounts in production')
  const digest = (s: string) => createHash('sha256').update(s).digest()
  const byToken = (token: string) =>
    users.find((u) => timingSafeEqual(digest(u.token), digest(token)))
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.NODE_ENV === 'production',
  }
  function checkOrigin(req: FastifyRequest) {
    // Browsers send Origin for mutations; non-browser bearer clients do not need cookies.
    if (req.headers.origin && req.headers.origin !== new URL(config.CORS_ORIGIN).origin)
      throw new AppError('unauthorized', 'Недопустимый источник запроса')
  }
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/v1/')) return
    if (req.routeOptions.url === '/v1/session') {
      checkOrigin(req)
      return
    }
    const header = req.headers.authorization
    if (config.DEV_AUTH && !header && !req.cookies[cookieName]) {
      principals.set(req, { id: 'local-user', companyIds: ['U_1', 'U_3'] })
      return
    }
    const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
    let user = header ? byToken(token) : undefined
    if (!header && req.cookies[cookieName]) {
      const signed = req.unsignCookie(req.cookies[cookieName])
      if (signed.valid && signed.value) {
        try {
          const session = z
            .object({ id: z.string(), expires: z.number() })
            .parse(JSON.parse(signed.value))
          if (session.expires > Date.now()) user = users.find((u) => u.id === session.id)
        } catch {
          /* Invalid cookies are treated as unauthenticated. */
        }
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOrigin(req)
    }
    if (!user) throw new AppError('unauthorized', 'Требуется авторизация')
    principals.set(req, { id: user.id, companyIds: user.companyIds })
  })
  app.register(async (child) => {
    const api = child.withTypeProvider<ZodTypeProvider>()
    api.post(
      '/v1/session',
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: {
          operationId: 'createSession',
          tags: ['workspace'],
          security: [],
          body: z.object({ token: z.string().min(32).max(4096) }),
          response: { 200: z.object({ id: z.string(), expiresAt: z.iso.datetime() }) },
        },
      },
      async (req, reply) => {
        const user = byToken(req.body.token)
        if (!user) throw new AppError('unauthorized', 'Ключ доступа не принят')
        const expires = Date.now() + ttl * 1000
        reply.header('Cache-Control', 'no-store')
        reply.setCookie(cookieName, JSON.stringify({ id: user.id, expires }), {
          ...cookieOptions,
          signed: true,
          maxAge: ttl,
        })
        return { id: user.id, expiresAt: new Date(expires).toISOString() }
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
