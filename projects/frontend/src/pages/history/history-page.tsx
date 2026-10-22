import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { companies, roles } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import type { RunRecord } from '@/entities/analysis'
import { PageHeading } from '@/components/page-heading'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const statuses: Record<RunRecord['status'], string> = {
  complete: 'Готово',
  partial: 'Частичный результат',
  empty: 'Нет событий',
  failed: 'Ошибка',
  cancelled: 'Отменён',
}

export function HistoryPage() {
  const { session } = useWorkspace()
  const history = session.history.filter(
    (run) => run.company === session.company && run.role === session.role,
  )
  return (
    <>
      <PageHeading
        title="История анализа"
        description={`${companies[session.company].name} · ${roles[session.role]}`}
        action={
          <Button asChild variant="outline">
            <Link to="/" search={{}}>
              К событиям
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
      {history.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запуск</TableHead>
                <TableHead className="text-right">Дата и время, МСК</TableHead>
                <TableHead className="text-right">Результат</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="py-5">
                    <span className="text-sm font-medium">Обновление сводки</span>
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {run.id.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {new Date(run.at).toLocaleString('ru-RU', {
                      timeZone: 'Europe/Moscow',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        run.status === 'failed'
                          ? 'text-destructive'
                          : run.status === 'complete'
                            ? 'text-positive'
                            : ''
                      }
                    >
                      {statuses[run.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            Последние {history.length} запусков для выбранной компании и роли. История хранится
            только в этом браузере.
          </p>
        </>
      ) : (
        <EmptyState
          title="Вы ещё не обновляли сводку"
          description="После запуска здесь появятся время и результат анализа. Отменённые и неудачные попытки тоже сохранятся."
          action={
            <Button asChild variant="outline">
              <Link to="/" search={{}}>
                Перейти к событиям
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
      )}
    </>
  )
}
