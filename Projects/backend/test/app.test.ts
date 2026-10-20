import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'

const apps: ReturnType<typeof buildApp>[] = []
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())) })

function createApp(extra: NodeJS.ProcessEnv = {}) {
  const app = buildApp(loadConfig({ LOG_LEVEL: 'silent', ...extra }))
  apps.push(app)
  return app
}

describe('scaffold lifecycle', () => {
  it('responds to liveness and reports that the optional database is not configured', async () => {
    const app = createApp()
    expect((await app.inject('/health')).json()).toEqual({ status: 'ok', service: 'backend' })
    expect((await app.inject('/ready')).json()).toEqual({ status: 'ok', database: 'not_configured' })
  })

  it('reports an unavailable configured database without leaking connection details', async () => {
    const app = createApp({ DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused' })
    const response = await app.inject('/ready')
    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'unavailable', database: 'unavailable' })
  })

  it('allows the configured browser origin and leaves domain routes unimplemented', async () => {
    const app = createApp()
    const response = await app.inject({ url: '/health', headers: { origin: 'http://localhost:3000' } })
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect((await app.inject('/v1/insights')).statusCode).toBe(404)
  })
})
