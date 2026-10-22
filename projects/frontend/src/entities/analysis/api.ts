import { api, unwrap, type operations } from '@/shared/lib'
export type ServerRun = operations['getRun']['responses'][200]['content']['application/json']
export type ServerInsight =
  operations['listInsights']['responses'][200]['content']['application/json']['items'][number]
export async function startServerAnalysis(
  companyId: string,
  perspective: 'cfo' | 'ceo',
  key: string,
  signal?: AbortSignal,
) {
  return unwrap(
    await api.POST('/v1/analysis-runs', {
      params: { header: { 'idempotency-key': key } },
      body: { companyId, perspective, kind: 'refresh_feed' },
      signal,
    }),
  )
}
export async function loadServerRun(id: string, signal?: AbortSignal): Promise<ServerRun> {
  return unwrap(await api.GET('/v1/analysis-runs/{id}', { params: { path: { id } }, signal }))
}
export async function cancelServerRun(id: string, signal?: AbortSignal) {
  return unwrap(
    await api.POST('/v1/analysis-runs/{id}/cancel', { params: { path: { id } }, signal }),
  )
}
export async function loadServerInsights(
  companyId: string,
  perspective: 'cfo' | 'ceo',
  signal?: AbortSignal,
): Promise<ServerInsight[]> {
  return unwrap(
    await api.GET('/v1/companies/{companyId}/insights', {
      params: { path: { companyId }, query: { perspective } },
      signal,
    }),
  ).items
}
