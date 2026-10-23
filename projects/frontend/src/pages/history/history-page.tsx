import { Link } from '@tanstack/react-router'
import { roles } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import {
  useRunHistory,
  useCancelRun,
  runLabels,
  runActive,
  runErrorMessage,
} from '@/entities/analysis'
import { errorMessage } from '@/shared/lib'
import { PageHeading } from '@/components/page-heading'
import { RequestError, RequestSkeleton } from '@/components/request-state'
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

export function HistoryPage() {
  const { session, company } = useWorkspace()
  const history = useRunHistory(session.company, session.role)
  const cancel = useCancelRun()
  const items = history.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <>
      <PageHeading
        title="История анализа"
        description={company?.displayName + ' · ' + roles[session.role]}
        action={
          <Button asChild variant="outline">
            <Link to="/" search={{}}>
              К событиям
            </Link>
          </Button>
        }
      />
      {history.error && (
        <RequestError
          message={errorMessage(history.error)}
          onRetry={() => void history.refetch()}
        />
      )}
      {cancel.error && <RequestError message={errorMessage(cancel.error)} />}
      {history.isPending ? (
        <RequestSkeleton />
      ) : items.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запуск</TableHead>
                <TableHead>Дата и время, МСК</TableHead>
                <TableHead>Результат</TableHead>
                <TableHead>
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="whitespace-normal py-5">
                    <span className="font-medium">
                      {run.input.kind === 'question' ? 'Ответ на вопрос' : 'Обновление сводки'}
                    </span>
                    {run.input.question && (
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        {run.input.question}
                      </p>
                    )}
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {run.id.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {new Date(run.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <Badge
                      variant="outline"
                      className={run.status === 'failed' ? 'text-destructive' : ''}
                    >
                      {runLabels[run.status]}
                    </Badge>
                    {run.error && (
                      <p className="mt-2 max-w-xs text-xs text-destructive">
                        {runErrorMessage(run.error)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {runActive(run.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancel.isPending || run.status === 'cancelling'}
                        onClick={() => cancel.mutate(run.id)}
                      >
                        Отменить
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {history.hasNextPage && (
            <Button
              variant="outline"
              className="mt-5"
              disabled={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              Показать ещё
            </Button>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            История запусков вашего аккаунта для выбранной компании и роли.
          </p>
        </>
      ) : (
        !history.error && (
          <EmptyState
            title="Вы ещё не обновляли сводку"
            description="Здесь появятся время и результат анализа, включая отменённые и неудачные попытки."
          />
        )
      )}
    </>
  )
}
