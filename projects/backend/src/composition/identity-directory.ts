import type { DataContext, Company } from '@alfa/agent'
import type { Identity } from '../modules/identity/index.js'
import type { Principal } from '../shared/kernel/errors.js'
export function identityDirectory(
  identity: Identity,
  data: DataContext,
  names: Map<string, string>,
) {
  return async (principal: Principal) => {
    for (const company of await identity.store.customCompanies(principal.companyIds)) {
      const p = company.profile
      const profile: Company = {
        id: company.id,
        profileSource: 'user',
        groupId: null,
        ownership: null,
        ageYears: null,
        developmentStage: null,
        okvedCode: null,
        okvedName: p.industry,
        keyOwnerMark: null,
        workersFns: p.employees === null ? null : String(p.employees),
        workersSpark: null,
        clientType: 'CLIENT',
        products: p.products,
        customs: {
          hasRecords: p.customsCountries.length ? true : null,
          countries: p.customsCountries,
        },
        revenue: p.revenue,
        city: null,
        region: p.region,
      }
      data.companies.companies.set(company.id, [profile])
      names.set(company.id, p.name)
    }
  }
}
