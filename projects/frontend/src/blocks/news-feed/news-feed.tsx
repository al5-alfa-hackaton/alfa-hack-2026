import { ArrowDownToLine, ArrowRight, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { featureValue, relevanceReason } from '@/entities/company'
import { useWorkspace } from '@/entities/workspace'
import type { Kind, Insight } from '@/entities/insight'
import { errorMessage } from '@/shared/lib'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/empty-state'
import { SaveButton } from './insight-actions'
import type { RefObject } from 'react'
export const kindLabels: Record<Kind, string> = {
  risk: 'Риск',
  opportunity: 'Возможность',
  context: 'Наблюдение',
}
const filterLabels = {
  all: 'Все',
  risk: 'Риски',
  opportunity: 'Возможности',
  context: 'Наблюдение',
}
export function NewsFilters({
  filter,
  onFilter,
  query,
  onQuery,
  counts,
  inputRef,
  onExport,
  canExport,
}: {
  filter: Kind | 'all'
  onFilter: (value: Kind | 'all') => void
  query: string
  onQuery: (value: string) => void
  counts: Record<Kind | 'all', number>
  inputRef: RefObject<HTMLInputElement | null>
  onExport: () => void
  canExport: boolean
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => {
          if (v) onFilter(v as Kind | 'all')
        }}
        aria-label="Фильтровать события"
        className="h-9 rounded-lg bg-muted/70 p-1"
      >
        {(['all', 'risk', 'opportunity', 'context'] as const).map((kind) => (
          <ToggleGroupItem
            key={kind}
            value={kind}
            aria-label={`${filterLabels[kind]}: ${counts[kind]}`}
            className="h-7 gap-1.5 rounded-md px-1.5 text-xs data-[state=on]:bg-background sm:gap-2 sm:px-3 sm:text-sm"
          >
            {filterLabels[kind]}
            <span className="tabular-nums text-muted-foreground">{counts[kind]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex w-full gap-2 sm:w-auto">
        <div className="relative min-w-0 flex-1 sm:w-56">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
          />
          <Input
            ref={inputRef}
            aria-label="Поиск по событиям"
            type="search"
            placeholder="Найти событие"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Скачать сводку"
              disabled={!canExport}
              onClick={onExport}
            >
              <ArrowDownToLine className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Скачать отфильтрованную сводку</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export function NewsRow({
  item,
  lead,
  onOpen,
}: {
  item: Insight
  lead: boolean
  onOpen: (id: string) => void
}) {
  return (
    <article
      className={'news-row group ' + (lead ? 'news-row-lead' : '')}
      data-testid={'news-' + item.id}
    >
      <div className="mb-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={'status-label status-' + item.kind}>
          <span aria-hidden="true" />
          {kindLabels[item.kind]}
        </span>
        <span>Приоритет {item.relevance.rank}</span>
        {item.event.happenedAt && (
          <time dateTime={item.event.happenedAt} className="ml-auto shrink-0 tabular-nums">
            {new Date(item.event.happenedAt).toLocaleDateString('ru-RU', {
              timeZone: 'Europe/Moscow',
            })}
          </time>
        )}
      </div>
      <div className="flex items-start gap-3">
        <h2
          className={
            'min-w-0 flex-1 font-semibold tracking-tight ' +
            (lead ? 'text-xl leading-7' : 'text-base leading-6')
          }
        >
          <Button
            variant="link"
            data-event-title={item.id}
            onClick={() => onOpen(item.id)}
            className="h-auto justify-start whitespace-normal p-0 text-left text-[length:inherit] font-semibold leading-[inherit] text-foreground"
          >
            {item.event.title}
          </Button>
        </h2>
        <SaveButton item={item} compact />
      </div>
      <p
        className={'mt-2.5 text-sm leading-6 text-muted-foreground ' + (lead ? '' : 'line-clamp-2')}
      >
        {item.summary}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="max-w-full text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">Почему для вас</span>
              <span className="mx-1.5">·</span>
              {item.relevance.reasons.map(relevanceReason).join(' · ')}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Релевантность {Math.round(item.relevance.score * 100)}/100. Это приоритет для вашей
            компании, а не достоверность новости.
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-2 px-2 text-xs"
          onClick={() => onOpen(item.id)}
        >
          Разобрать влияние
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </article>
  )
}
export function FeedContext() {
  const { context } = useWorkspace()
  const data = context.data
  return (
    <aside
      className="space-y-7 border-t pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
      aria-label="Контекст персонализации"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Что учитываем</h2>
        <Link
          to="/company"
          search={{}}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Весь профиль
          <ArrowRight className="ml-1 inline size-3" />
        </Link>
      </div>
      {context.error && (
        <RequestError
          message={errorMessage(context.error)}
          onRetry={() => void context.refetch()}
        />
      )}
      {context.isPending && <RequestSkeleton />}
      {data && (
        <>
          <section>
            <p className="mb-4 text-sm font-medium">{data.company.displayName}</p>
            <dl className="space-y-3 text-xs">
              {data.features
                .filter((f) => f.value !== null)
                .slice(0, 5)
                .map((f) => (
                  <div key={f.id}>
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="mt-1 leading-5">{featureValue(f.value, f.id)}</dd>
                  </div>
                ))}
            </dl>
          </section>
          <section className="border-t pt-5">
            <h2 className="mb-2 text-sm font-semibold">Границы анализа</h2>
            {data.gaps.slice(0, 3).map((gap) => (
              <p key={gap} className="mt-2 text-xs leading-5 text-muted-foreground">
                {gap}
              </p>
            ))}
          </section>
          {data.profileSource === 'user' && (
            <p className="text-xs text-muted-foreground">Профиль заполнен пользователем.</p>
          )}
          {data.dataMode === 'fixture' && (
            <p className="text-xs text-muted-foreground">Подключён тестовый набор данных.</p>
          )}
        </>
      )}
    </aside>
  )
}
export function NoNews({
  saved,
  query,
  onReset,
}: {
  saved: boolean
  query: string
  onReset: () => void
}) {
  return (
    <EmptyState
      title={
        saved && !query ? 'Сохраните то, к чему хотите вернуться' : 'По этому запросу ничего нет'
      }
      description={
        saved && !query
          ? 'Нажмите на закладку рядом с событием. Сохранённые материалы доступны в вашем аккаунте.'
          : 'Измените запрос или сбросьте фильтры.'
      }
      action={
        <Button variant="outline" onClick={onReset}>
          {saved ? 'Перейти к событиям' : 'Сбросить фильтры'}
        </Button>
      }
    />
  )
}
