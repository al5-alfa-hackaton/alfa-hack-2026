import { Loader2 } from 'lucide-react'
import { steps } from '@/entities/analysis'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export function AnalysisProgress({ step, onCancel }: { step: number; onCancel: () => void }) {
  return (
    <section className="mb-6 rounded-lg border p-4" aria-label="Ход обновления">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p role="status" className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" />
          {steps[step]}
        </p>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Отменить
        </Button>
      </div>
      <Progress aria-label="Этапы анализа" value={step * 25} className="h-1" />
      <p className="mt-3 text-xs text-muted-foreground">
        Демо-анализ · этап {step + 1} из {steps.length}. До завершения показана предыдущая сводка.
      </p>
    </section>
  )
}
