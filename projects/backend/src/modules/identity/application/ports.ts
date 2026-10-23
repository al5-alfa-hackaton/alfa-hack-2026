import type { CompanyInput, CustomCompany, IdentityRecord } from '../domain/model.js'
export interface IdentityStore {
  byId(id: string): Promise<IdentityRecord | undefined>
  byUsername(username: string): Promise<IdentityRecord | undefined>
  register(
    user: { id: string; username: string; passwordHash: string },
    company: { id: string; profile: CompanyInput },
  ): Promise<IdentityRecord>
  customCompanies(ids: readonly string[]): Promise<CustomCompany[]>
}
export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(password: string, hash: string): Promise<boolean>
}
