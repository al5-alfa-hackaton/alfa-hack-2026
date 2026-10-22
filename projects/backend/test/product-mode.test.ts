import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'
import { Companies } from '../src/modules/companies/index.js'
import { Analytics } from '../src/modules/analytics/application/analytics.js'
import type { AnalyticsStore } from '../src/modules/analytics/application/ports.js'
const principal = { id: 'owner', companyIds: ['U_1'] }
async function setup() {
  const data = await createData(loadConfig({ NODE_ENV: 'test' }))
  const companies = new Companies(new ResearchCatalog(data, 'research'))
  const createRun = vi.fn()
  const store = {
    createRun,
    insights: async () => [{ dataMode: 'fixture' }, { dataMode: 'research' }],
    insight: async () => ({ dataMode: 'fixture', companyId: 'U_1' }),
  } as unknown as AnalyticsStore
  return {
    createRun,
    service: new Analytics(store, companies, {
      reservation: 25,
      limit: 500,
      mode: 'research',
      available: false,
    }),
  }
}
describe('actual data mode', () => {
  it('rejects unconfigured analysis before reserving money or creating jobs', async () => {
    const { createRun, service } = await setup()
    await expect(
      service.start(
        principal,
        { companyId: 'U_1', perspective: 'cfo', kind: 'refresh_feed' },
        'request-key',
      ),
    ).rejects.toMatchObject({ code: 'unavailable' })
    expect(createRun).not.toHaveBeenCalled()
  })
  it('does not expose historical fixture insights as actual research output', async () => {
    const { service } = await setup()
    expect(await service.feed(principal, 'U_1', 'cfo')).toEqual([{ dataMode: 'research' }])
    await expect(service.detail(principal, 'old-fixture-id', 'cfo')).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
