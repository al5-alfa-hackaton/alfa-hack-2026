import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '@/shared/lib'
import { cancelServerRun, startServerAnalysis, type ServerRun } from './api'

export const runActive = (status: ServerRun['status']) =>
  ['queued', 'running', 'cancelling'].includes(status)
export const runLabels: Record<ServerRun['status'], string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  cancelling: 'Отменяется',
  completed: 'Готово',
  partial: 'Готово с ограничениями',
  failed: 'Ошибка',
  cancelled: 'Отменено',
}
export function useRunHistory(companyId: string, perspective: 'cfo' | 'ceo') {
  return useInfiniteQuery({
    queryKey: ['history', companyId, perspective],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      unwrap(
        await api.GET('/v1/companies/{companyId}/analysis-runs', {
          params: { path: { companyId }, query: { perspective, limit: 100, cursor: pageParam } },
          signal,
        }),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!companyId,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) => page.items.some((run) => runActive(run.status)))
        ? 1000
        : 15_000,
  })
}
export function useCancelRun() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelServerRun(id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['history'] })
    },
  })
}
export { startServerAnalysis }
