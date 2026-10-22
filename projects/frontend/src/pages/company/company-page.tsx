import { ServerWorkspace } from '@/blocks/server-workspace'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Info } from 'lucide-react'
import { companies } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import { PageHeading } from '@/components/page-heading'
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
  const { session } = useWorkspace()
  const company = companies[session.company]
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
      <Tabs defaultValue="demo">
        <TabsList aria-label="Источник данных">
          <TabsTrigger value="demo">Демо-профиль</TabsTrigger>
          <TabsTrigger value="server">Данные сервиса</TabsTrigger>
        </TabsList>
        <TabsContent value="server">
          <ServerWorkspace />
        </TabsContent>
        <TabsContent value="demo">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section>
              <h2 className="text-xl font-semibold tracking-tight">{company.name}</h2>
              <p className="mb-7 mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                {company.description}
              </p>
              <dl className="profile-facts mb-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                {[
                  ['Выручка', company.revenue],
                  ['Сотрудники', company.employees],
                  ['Регион', company.region],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-2 text-base font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <h2 className="mb-3 text-base font-semibold">Что влияет на персонализацию</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Признак</TableHead>
                    <TableHead className="text-right">Источник</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.features.map((feature) => (
                    <TableRow key={feature}>
                      <TableCell className="whitespace-normal py-4 text-sm">{feature}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        Демо-профиль
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Синтетический профиль · версия 1. Не основан на данных клиента банка. Доля рынка
                неизвестна и не используется.
              </p>
            </section>
            <aside className="space-y-5">
              <Alert>
                <Info className="size-4" />
                <AlertTitle>Не хватает данных</AlertTitle>
                <AlertDescription>{company.missing}</AlertDescription>
              </Alert>
              <section className="px-1">
                <h2 className="mb-2 text-sm font-semibold">Как это меняет вывод</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  Анализ показывает направление влияния, но не точный денежный эффект. Неизвестные
                  признаки не подменяются предположениями.
                </p>
              </section>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
