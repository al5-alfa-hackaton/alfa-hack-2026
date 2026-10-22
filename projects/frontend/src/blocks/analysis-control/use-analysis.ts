import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRunHistory, useCancelRun, runActive, startServerAnalysis } from '@/entities/analysis'
import { useWorkspace } from '@/entities/workspace'

export function useAnalysis() {
  const { session } = useWorkspace()
  const cache = useQueryClient()
  const history = useRunHistory(session.company, session.role)
  const runs = history.data?.pages.flatMap((page) => page.items) ?? []
  const run = runs.find((r) => r.input.kind === 'refresh_feed' && runActive(r.status))
  const latest = runs.find((r) => r.input.kind === 'refresh_feed')
  const request = useRef<{ scope: string; key: string } | null>(null)
  const scope = JSON.stringify(session)
  const start = useMutation({
    mutationFn: () => {
      if (request.current?.scope !== scope) request.current = { scope, key: crypto.randomUUID() }
      return startServerAnalysis(session.company, session.role, request.current.key)
    },
    onSuccess: async () => {
      request.current = null
      await cache.invalidateQueries({ queryKey: ['history'] })
    },
  })
  const cancel = useCancelRun()
  useEffect(() => {
    if (latest && !runActive(latest.status)) {
      void cache.invalidateQueries({ queryKey: ['feed', latest.companyId, latest.perspective] })
    }
  }, [cache, latest?.id, latest?.status])
  return {
    run,
    latest,
    running: !!run || start.isPending,
    history,
    error: start.error ?? cancel.error,
    analyze: () => start.mutate(),
    cancel: () => {
      if (run) cancel.mutate(run.id)
    },
    cancelling: cancel.isPending || run?.status === 'cancelling',
  }
}
