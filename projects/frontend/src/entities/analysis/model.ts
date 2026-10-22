import type { CompanyId, Role } from '@/entities/company'
import { delay } from '@/shared/lib'
export type Scenario = 'normal' | 'partial' | 'empty' | 'error' | 'budget' | 'denied'
export const steps = [
  'Изучаем профиль компании',
  'Отбираем значимые события',
  'Сопоставляем источники',
  'Проверяем выводы',
]
export async function runAnalysis(
  scenario: Scenario,
  signal: AbortSignal,
  progress: (step: number) => void,
  duration = 650,
) {
  for (let i = 0; i < steps.length; i++) {
    progress(i)
    await delay(duration, signal)
    if (i === 1 && ['error', 'budget', 'denied'].includes(scenario)) throw new Error(scenario)
  }
  return scenario === 'partial' ? 'partial' : scenario === 'empty' ? 'empty' : 'complete'
}
export type RunRecord = {
  id: string
  company: CompanyId
  role: Role
  at: string
  status: 'complete' | 'partial' | 'empty' | 'failed' | 'cancelled'
}
