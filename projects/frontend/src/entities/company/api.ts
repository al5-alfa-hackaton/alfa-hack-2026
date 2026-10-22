import { api, unwrap, type operations } from '@/shared/lib'
export type ServerCompanyContext =
  operations['companyContext']['responses'][200]['content']['application/json']
export type ServerCompany =
  operations['listCompanies']['responses'][200]['content']['application/json']['items'][number]
export async function loadServerCompanies(signal?: AbortSignal) {
  return unwrap(await api.GET('/v1/companies', { signal })).items
}
export async function loadServerContext(
  companyId: string,
  signal?: AbortSignal,
): Promise<ServerCompanyContext> {
  return unwrap(
    await api.GET('/v1/companies/{companyId}/context', { params: { path: { companyId } }, signal }),
  )
}
