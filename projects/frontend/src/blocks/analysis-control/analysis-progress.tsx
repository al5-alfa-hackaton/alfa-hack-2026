import { Loader2 } from 'lucide-react'
import { runLabels, type ServerRun } from '@/entities/analysis'
import { Button } from '@/components/ui/button'

export function AnalysisProgress({
  run,
  onCancel,
  cancelling,
}: {
  run?: ServerRun
  onCancel: () => void
  cancelling: boolean
}) {
  return (
    <section className="mb-6 rounded-lg border p-4" aria-label="Ход обновления">
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin" />
          {run ? runLabels[run.status] : 'Отправляем задание…'}
        </p>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={!run || cancelling}>
          Отменить
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        До завершения показана предыдущая сводка. Анализ продолжится, если вы закроете страницу.
      </p>
    </section>
  )
}
