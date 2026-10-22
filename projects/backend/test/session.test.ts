import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
const token = 'local-test-key-'.repeat(4)
const accounts = [{ id: 'analyst', token, companyIds: ['U_1'] }]
const apps: Awaited<ReturnType<typeof buildApp>>[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})
async function create() {
  const app = await buildApp(
    loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      AUTH_USERS_JSON: JSON.stringify(accounts),
    }),
  )
  apps.push(app)
  await app.ready()
  return app
}
describe('browser sessions without SSO', () => {
  it('exchanges the access key for a private expiring cookie and keeps scopes on the server', async () => {
    const app = await create()
    const login = await app.inject({ method: 'POST', url: '/v1/session', payload: { token } })
    expect(login.statusCode).toBe(200)
    expect(login.body).not.toContain(token)
    expect(login.headers['cache-control']).toContain('no-store')
    const cookie = login.cookies[0]!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Strict')
    expect(cookie.maxAge).toBe(28800)
    const headers = { cookie: cookie.name + '=' + encodeURIComponent(cookie.value) }
    const me = await app.inject({ url: '/v1/me', headers })
    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({ id: 'analyst', companyIds: ['U_1'], analysisAvailable: true })
    expect((await app.inject({ url: '/v1/companies/U_3/context', headers })).statusCode).toBe(404)
    const logout = await app.inject({ method: 'DELETE', url: '/v1/session', headers })
    expect(logout.statusCode).toBe(204)
    expect(logout.cookies[0]?.value).toBe('')
    expect((await app.inject('/v1/me')).statusCode).toBe(401)
    expect(app.swagger().paths).toHaveProperty('/v1/session')
  })
  it('rejects bad keys, altered cookies, expired sessions and foreign-origin mutations', async () => {
    const app = await create()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/session',
          payload: { token: 'wrong'.repeat(10) },
        })
      ).statusCode,
    ).toBe(401)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/session',
          headers: { origin: 'https://other.example' },
          payload: { token },
        })
      ).statusCode,
    ).toBe(401)
    const expired = app.signCookie(JSON.stringify({ id: 'analyst', expires: Date.now() - 1 }))
    const forged =
      app.signCookie(JSON.stringify({ id: 'analyst', expires: Date.now() + 10000 })) + 'tampered'
    for (const value of [expired, forged])
      expect(
        (
          await app.inject({
            url: '/v1/me',
            headers: { cookie: 'alfa_session=' + encodeURIComponent(value) },
          })
        ).statusCode,
      ).toBe(401)
    const login = await app.inject({ method: 'POST', url: '/v1/session', payload: { token } })
    const cookie = login.cookies[0]!
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: '/v1/session',
          headers: {
            origin: 'https://other.example',
            cookie: cookie.name + '=' + encodeURIComponent(cookie.value),
          },
        })
      ).statusCode,
    ).toBe(401)
  })
  it('keeps existing bearer clients and rejects an invalid bearer even with a valid cookie', async () => {
    const app = await create()
    expect(
      (await app.inject({ url: '/v1/me', headers: { authorization: 'Bearer ' + token } }))
        .statusCode,
    ).toBe(200)
    const cookie = app.signCookie(JSON.stringify({ id: 'analyst', expires: Date.now() + 10000 }))
    expect(
      (
        await app.inject({
          url: '/v1/me',
          headers: {
            authorization: 'Bearer invalid',
            cookie: 'alfa_session=' + encodeURIComponent(cookie),
          },
        })
      ).statusCode,
    ).toBe(401)
  })
  it('uses real data mode by default and requires explicit fixture mode outside tests', () => {
    expect(loadConfig({}).AGENT_PROVIDER).toBe('disabled')
    expect(loadConfig({ NODE_ENV: 'test' }).AGENT_PROVIDER).toBe('fixture')
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        AUTH_USERS_JSON: JSON.stringify(accounts),
        AGENT_PROVIDER: 'fixture',
      }),
    ).toThrow()
  })
})
