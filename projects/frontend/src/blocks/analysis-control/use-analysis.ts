import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { runAnalysis, type RunRecord, type Scenario } from '@/entities/analysis'
import { useWorkspace } from '@/entities/workspace'

export function useAnalysis() {
  const { session, setSession } = useWorkspace()
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<'complete' | 'partial' | 'empty'>('complete')
  const [error, setError] = useState('')
  const [scenario, setScenario] = useState<Scenario>('normal')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    setResult('complete')
    setError('')
    setRunning(false)
    return () => {
      controller.current?.abort()
      controller.current = null
    }
  }, [session.company, session.role])

  const analyze = useCallback(
    async (mode: Scenario = scenario) => {
      if (controller.current) return
      const ac = new AbortController()
      controller.current = ac
      const record = {
        id: crypto.randomUUID(),
        company: session.company,
        role: session.role,
        at: new Date().toISOString(),
      }
      let status: RunRecord['status'] = 'failed'
      setRunning(true)
      setError('')
      setStep(0)
      try {
        const value = await runAnalysis(mode, ac.signal, setStep)
        if (!ac.signal.aborted) {
          setResult(value)
          status = value
        }
        toast.success(value === 'partial' ? 'Сводка обновлена с ограничениями' : 'Сводка обновлена')
      } catch (cause) {
        if (ac.signal.aborted) {
          status = 'cancelled'
          toast('Анализ отменён. Предыдущая сводка сохранена.')
        } else setError(cause instanceof Error ? cause.message : 'error')
      } finally {
        if (controller.current === ac) {
          controller.current = null
          setRunning(false)
        }
        setSession((s) => ({ ...s, history: [{ ...record, status }, ...s.history].slice(0, 50) }))
      }
    },
    [scenario, session.company, session.role, setSession],
  )
  return {
    running,
    step,
    result,
    error,
    scenario,
    setScenario,
    analyze,
    cancel: () => controller.current?.abort(),
  }
}
