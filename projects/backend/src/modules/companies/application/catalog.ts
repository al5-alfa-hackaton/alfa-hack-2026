import { requireCompany, type Principal } from '../../../shared/kernel/errors.js'
export type CompanySummary = {
  id: string
  displayName: string
  industry: string | null
  region: string | null
}
export type CompanyContext = {
  company: CompanySummary
  profileVersion: string
  corpusVersion: string
  dataMode: 'fixture' | 'research'
  features: { id: string; label: string; value: string | null }[]
  gaps: string[]
  limitations: string[]
}
export interface CompanyCatalog {
  list(): CompanySummary[]
  context(id: string): CompanyContext
}
export class Companies {
  constructor(private readonly catalog: CompanyCatalog) {}
  list(principal: Principal, query = '') {
    return this.catalog
      .list()
      .filter(
        (c) =>
          principal.companyIds.includes(c.id) &&
          `${c.id} ${c.industry ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
  }
  context(principal: Principal, companyId: string) {
    requireCompany(principal, companyId)
    return this.catalog.context(companyId)
  }
}
