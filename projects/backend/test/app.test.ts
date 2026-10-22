import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
const apps: Awaited<ReturnType<typeof buildApp>>[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})
async function createApp(extra: NodeJS.ProcessEnv = {}) {
  const app = await buildApp(loadConfig({ LOG_LEVEL: 'silent', NODE_ENV: 'test', ...extra }))
  apps.push(app)
  return app
}
describe('API boundary', () => {
  it('keeps liveness independent and readiness honest without DB', async () => {
    const app = await createApp()
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok', service: 'backend' })
    expect((await app.inject('/ready')).statusCode).toBe(503)
  })
  it('does not expose database credentials in readiness errors', async () => {
    const app = await createApp({ DATABASE_URL: 'postgresql://unused:secret@127.0.0.1:1/unused' })
    const response = await app.inject('/ready')
    expect(response.statusCode).toBe(503)
    expect(response.body).not.toContain('secret')
  })
  it('requires server-side authentication and denies spoofed scope headers', async () => {
    const app = await createApp()
    const response = await app.inject({
      url: '/v1/me',
      headers: { 'x-user-id': 'admin', 'x-company-id': 'U_1' },
    })
    expect(response.statusCode).toBe(401)
    expect(response.json().code).toBe('unauthorized')
  })
  it('restricts company lists, validates requests, and publishes OpenAPI', async () => {
    const app = await createApp({ DEV_AUTH: 'true' })
    const companies = (await app.inject('/v1/companies')).json()
    expect(companies.items.map((c: { id: string }) => c.id)).toEqual(['U_1', 'U_3'])
    expect((await app.inject('/v1/companies/U_2/context')).statusCode).toBe(404)
    expect((await app.inject('/v1/companies/U_1/context')).json().dataMode).toBe('fixture')
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/analysis-runs',
          payload: { companyId: 'U_1' },
        })
      ).statusCode,
    ).toBe(400)
    expect(app.swagger().paths).toHaveProperty('/v1/analysis-runs')
    const response = await app.inject({
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    })
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  })
  it('forbids fixture/auth shortcuts in production and unbounded paid requests', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DEV_AUTH: 'true' })).toThrow()
    expect(() => loadConfig({ AGENT_PROVIDER: 'langgraph' })).toThrow()
  })
})
