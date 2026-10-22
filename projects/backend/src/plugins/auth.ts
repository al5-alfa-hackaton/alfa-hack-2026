import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { AppError, type Principal } from '../shared/kernel/errors.js'
import type { Config } from '../config.js'
const principals = new WeakMap<FastifyRequest, Principal>()
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
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/v1/')) return
    const header = req.headers.authorization
    if (config.DEV_AUTH && !header) {
      principals.set(req, { id: 'local-demo', companyIds: ['U_1', 'U_3'] })
      return
    }
    const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
    const user = users.find((u) => timingSafeEqual(digest(u.token), digest(token)))
    if (!user) throw new AppError('unauthorized', 'Требуется авторизация')
    principals.set(req, { id: user.id, companyIds: user.companyIds })
  })
}
