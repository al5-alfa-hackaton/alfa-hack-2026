import { Loader2 } from 'lucide-react'
import { runLabels, type ServerRun } from '@/entities/analysis'
import { Button } from '@/components/ui/button'
import { NewsAnimation } from '@/components/news-animation'

export function AnalysisProgress({
  run,
  onCancel,
  cancelling,
  firstRun = false,
}: {
  run?: ServerRun
  onCancel: () => void
  cancelling: boolean
  firstRun?: boolean
}) {
  return (
    <section
      className={
        firstRun
          ? 'state-enter mx-auto flex min-h-[50dvh] max-w-md flex-col justify-center gap-5 text-center'
          : 'state-enter mb-6 rounded-xl border bg-muted/20 p-4'
      }
      aria-label="Ход обновления"
    >
      {firstRun && <NewsAnimation />}
      <div className={firstRun ? 'contents' : 'flex items-center justify-between gap-3'}>
        <p
          role="status"
          className={
            'flex items-center gap-2 text-sm font-medium ' + (firstRun ? 'justify-center' : '')
          }
        >
          {!firstRun && <Loader2 className="size-4 animate-spin" />}
          {run ? runLabels[run.status] : 'Отправляем задание…'}
        </p>
        <Button
          className={firstRun ? 'order-last self-center' : ''}
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={!run || cancelling}
        >
          Отменить
        </Button>
      </div>
      <p
        className={
          (firstRun ? 'mx-auto max-w-xs' : 'mt-3') + ' text-xs leading-6 text-muted-foreground'
        }
      >
        {firstRun
          ? 'Подбираем события для вашей компании. '
          : 'До завершения показана предыдущая сводка. '}
        Анализ продолжится, если вы закроете страницу.
      </p>
    </section>
  )
}
