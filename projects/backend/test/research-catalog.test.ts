import { expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createData } from '../src/composition/data.js'
import { ResearchCatalog } from '../src/modules/companies/infrastructure/research-catalog.js'

it('summarizes all group industries and exposes guarantees', async () => {
  const data = await createData(loadConfig({ NODE_ENV: 'test' }))
  const company = data.companies.companies.get('U_1')![0]!
  company.groupId = 'test-group'
  company.products.guarantees = true
  const memberIds = ['U_1']
  for (let index = 0; index < 36; index++) {
    const id = `member-${index}`
    memberIds.push(id)
    data.companies.companies.set(id, [{ ...company, id, okvedName: `Отрасль ${index % 6}` }])
  }
  data.companies.groups.set('test-group', memberIds)
  const context = new ResearchCatalog(data, 'research').context('U_1')
  expect(context.features.find((feature) => feature.id === 'guarantees')?.value).toBe('true')
  const group = context.features.find((feature) => feature.id === 'group_industries')!.value!
  expect(group).toContain('Отрасль 0 — 6')
  expect(group).toContain('Отрасль 4 — 6')
  expect(group).not.toContain('Отрасль 5')
  expect(group).toContain('ещё 1')
  expect(group.split('; ')).toHaveLength(6)
})
