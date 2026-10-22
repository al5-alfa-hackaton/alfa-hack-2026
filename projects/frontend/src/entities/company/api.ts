import { api, unwrap, type operations } from '@/shared/lib'
export type ServerCompanyContext =
  operations['companyContext']['responses'][200]['content']['application/json']
export type ServerCompany =
  operations['listCompanies']['responses'][200]['content']['application/json']['items'][number]
export async function loadServerCompanies(signal?: AbortSignal) {
  const items: ServerCompany[] = []
  let cursor: string | undefined
  do {
    const page = unwrap(
      await api.GET('/v1/companies', {
        params: { query: { limit: 100, cursor } },
        signal,
      }),
    )
    items.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return items
}
export async function loadServerContext(
  companyId: string,
  signal?: AbortSignal,
): Promise<ServerCompanyContext> {
  return unwrap(
    await api.GET('/v1/companies/{companyId}/context', { params: { path: { companyId } }, signal }),
  )
}
