import type {
  AccountSummary,
  CompanyInput,
  CustomCompany,
  IdentityRecord,
} from '../domain/model.js'
export interface IdentityStore {
  byId(id: string): Promise<IdentityRecord | undefined>
  search(query: string, limit: number): Promise<AccountSummary[]>
  register(
    user: { id: string; username: string; sessionVersion: string },
    company: { id: string; profile: CompanyInput },
  ): Promise<IdentityRecord>
  customCompanies(ids: readonly string[]): Promise<CustomCompany[]>
}
