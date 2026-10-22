import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap, type operations } from '@/shared/lib'

export type Insight =
  operations['getInsight']['responses'][200]['content']['application/json']['insight']
export type UserState =
  operations['getInsight']['responses'][200]['content']['application/json']['userState']
export type Kind = Insight['kind']

export function useFeed(companyId: string, perspective: 'cfo' | 'ceo', saved: boolean) {
  return useInfiniteQuery({
    queryKey: [saved ? 'saved' : 'feed', companyId, perspective],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) => {
      const params = { path: { companyId }, query: { perspective, limit: 50, cursor: pageParam } }
      return saved
        ? unwrap(await api.GET('/v1/companies/{companyId}/saved-insights', { params, signal }))
        : unwrap(await api.GET('/v1/companies/{companyId}/insights', { params, signal }))
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!companyId,
  })
}
export function useInsight(id: string | undefined, perspective: 'cfo' | 'ceo') {
  return useQuery({
    queryKey: ['insight', id, perspective],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/insights/{id}', {
          params: { path: { id: id! }, query: { perspective } },
          signal,
        }),
      ),
    enabled: !!id,
  })
}
export function useSaveInsight(item: Insight, state?: UserState) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const params = { path: { id: item.id } }
      if (state?.savedAt)
        unwrap(
          await api.DELETE('/v1/me/saved-insights/{id}', {
            params: { ...params, query: { perspective: item.perspective, version: item.version } },
          }),
        )
      else
        unwrap(
          await api.PUT('/v1/me/saved-insights/{id}', {
            params,
            body: { perspective: item.perspective, version: item.version },
          }),
        )
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['saved', item.companyId, item.perspective] }),
        cache.invalidateQueries({ queryKey: ['insight', item.id, item.perspective] }),
      ])
    },
  })
}
export function useFeedback(item: Insight) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (feedback: UserState['feedback']) =>
      unwrap(
        await api.PUT('/v1/insights/{id}/feedback', {
          params: { path: { id: item.id } },
          body: { perspective: item.perspective, version: item.version, ...feedback },
        }),
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['insight', item.id, item.perspective] })
    },
  })
}
export function useConversation(item: Insight, active: boolean) {
  return useQuery({
    queryKey: ['conversation', item.id, item.perspective],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/insights/{id}/conversation', {
          params: { path: { id: item.id }, query: { perspective: item.perspective } },
          signal,
        }),
      ),
    refetchInterval: active ? 1000 : false,
  })
}
export async function askQuestion(item: Insight, question: string, key: string) {
  return unwrap(
    await api.POST('/v1/insights/{id}/questions', {
      params: { path: { id: item.id }, header: { 'idempotency-key': key } },
      body: { perspective: item.perspective, insightVersion: item.version, question },
    }),
  )
}
export function useTrace(item: Insight) {
  return useQuery({
    queryKey: ['trace', item.id, item.perspective],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/insights/{id}/trace', {
          params: { path: { id: item.id }, query: { perspective: item.perspective } },
          signal,
        }),
      ),
  })
}
export function useDocument(documentId: string, page: number, offset: number) {
  return useQuery({
    queryKey: ['document', documentId, page, offset],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/v1/documents/{documentId}', {
          params: { path: { documentId }, query: { page, offset, length: 4000 } },
          signal,
        }),
      ),
  })
}
