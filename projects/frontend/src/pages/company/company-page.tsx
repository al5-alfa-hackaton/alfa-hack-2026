import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { featureValue } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { PageHeading } from '@/components/page-heading'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function CompanyPage() {
  const { context } = useWorkspace()
  const data = context.data
  return (
    <>
      <PageHeading
        title="Контекст компании"
        description="Признаки, на которых основаны отбор событий и интерпретация."
        action={
          <Button asChild variant="outline">
            <Link to="/" search={{}}>
              <ArrowLeft className="size-4" />К сводке
            </Link>
          </Button>
        }
      />
      {context.error && (
        <RequestError
          message={errorMessage(context.error)}
          onRetry={() => void context.refetch()}
        />
      )}
      {context.isPending && <RequestSkeleton />}
      {data && (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <h2 className="text-xl font-semibold tracking-tight">{data.company.displayName}</h2>
            <p className="mb-7 mt-2 text-sm leading-7 text-muted-foreground">
              {[data.company.industry, data.company.region].filter(Boolean).join(' · ')}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Признак</TableHead>
                  <TableHead>Значение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.features.map((feature) => (
                  <TableRow key={feature.id}>
                    <TableCell className="whitespace-normal py-4">{feature.label}</TableCell>
                    <TableCell className="whitespace-normal">
                      {featureValue(feature.value, feature.id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 break-all text-xs leading-5 text-muted-foreground">
              Источник:{' '}
              {data.dataMode === 'research' ? 'набор данных организаторов' : 'тестовый набор'} ·
              Версия профиля: {data.profileVersion}
            </p>
          </section>
          <aside className="space-y-5">
            {data.gaps.length > 0 && (
              <Alert>
                <AlertTitle>Не хватает данных</AlertTitle>
                <AlertDescription>
                  <ul className="space-y-2">
                    {data.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <section className="px-1">
              <h2 className="mb-2 text-sm font-semibold">Границы анализа</h2>
              {data.limitations.map((text) => (
                <p key={text} className="mb-3 text-sm leading-7 text-muted-foreground">
                  {text}
                </p>
              ))}
              <p className="text-sm leading-7 text-muted-foreground">
                Неизвестные признаки не подменяются предположениями.
              </p>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
