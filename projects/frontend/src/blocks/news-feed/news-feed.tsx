import { ArrowDownToLine, ArrowRight, Bookmark, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { companies } from '@/entities/company'
import { scopeKey, useWorkspace } from '@/entities/workspace'
import type { Kind, News } from '@/entities/insight'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/empty-state'
import type { RefObject } from 'react'

export const kindLabels: Record<Kind, string> = {
  risk: 'Риск',
  opportunity: 'Возможность',
  watch: 'Наблюдение',
}
const filterLabels = { all: 'Все', risk: 'Риски', opportunity: 'Возможности', watch: 'Наблюдение' }
export type RankedNews = News & { score: number }

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
        {(['all', 'risk', 'opportunity', 'watch'] as const).map((kind) => (
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
  item: RankedNews
  lead: boolean
  onOpen: (id: string) => void
}) {
  const { session, setSession } = useWorkspace()
  const savedKey = scopeKey(session.company, session.role, item.id)
  const saved = session.saved.includes(savedKey)
  const context = item.context[session.company]
  return (
    <article
      className={`news-row group ${lead ? 'news-row-lead' : ''}`}
      data-testid={`news-${item.id}`}
    >
      <div className="mb-2.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`status-label status-${item.kind}`}>
          <span aria-hidden="true" />
          {kindLabels[item.kind]}
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="truncate">{item.category}</span>
        <time className="ml-auto shrink-0 tabular-nums">{item.time}</time>
      </div>
      <div className="flex items-start gap-3">
        <h2
          className={`min-w-0 flex-1 font-semibold tracking-tight ${lead ? 'text-xl leading-7' : 'text-base leading-6'}`}
        >
          <Button
            variant="link"
            data-event-title={item.id}
            onClick={() => onOpen(item.id)}
            className="h-auto justify-start whitespace-normal p-0 text-left text-[length:inherit] font-semibold leading-[inherit] text-foreground"
          >
            {item.title}
          </Button>
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1 shrink-0"
              aria-label={`${saved ? 'Убрать из сохранённого' : 'Сохранить'}: ${item.title}`}
              aria-pressed={saved}
              onClick={() => {
                setSession((s) => ({
                  ...s,
                  saved: saved ? s.saved.filter((k) => k !== savedKey) : [...s.saved, savedKey],
                }))
                toast(saved ? 'Событие убрано из сохранённого' : 'Событие сохранено')
              }}
            >
              <Bookmark className={`size-4 ${saved ? 'fill-current' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{saved ? 'Убрать из сохранённого' : 'Сохранить событие'}</TooltipContent>
        </Tooltip>
      </div>
      <p className={`mt-2.5 text-sm leading-6 text-muted-foreground ${lead ? '' : 'line-clamp-2'}`}>
        {context.impact}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="max-w-full text-xs leading-5 text-muted-foreground">
              <span className="font-medium text-foreground">Почему для вас</span>
              <span className="mx-1.5">·</span>
              {context.reason}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Приоритет {item.score}/100 — сценарная релевантность компании и роли, не достоверность.
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
  const { session } = useWorkspace()
  const company = companies[session.company]
  return (
    <aside
      className="space-y-7 border-t pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
      aria-label="Контекст персонализации"
    >
      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
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
        <p className="mb-4 text-sm font-medium">{company.name}</p>
        <dl className="mb-5 space-y-2.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Отрасль</dt>
            <dd className="text-right">{company.industry}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Выручка</dt>
            <dd className="text-right tabular-nums">{company.revenue}</dd>
          </div>
        </dl>
        <ul className="space-y-3">
          {company.features.map((feature) => (
            <li key={feature} className="flex gap-2.5 text-xs leading-5">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
      <section className="border-t pt-5">
        <h2 className="mb-2 text-sm font-semibold">Границы анализа</h2>
        <p className="text-xs leading-5 text-muted-foreground">{company.missing}</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Без этих данных нельзя оценить эффект в рублях.
        </p>
      </section>
      <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
        Синтетический профиль · версия 1<br />
        Данные сводки: 21 октября 2026
      </p>
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
          ? 'Нажмите на закладку рядом с событием. Сохранённые материалы останутся в этом браузере для выбранной компании и роли.'
          : 'Измените запрос или сбросьте фильтры — остальные события на месте.'
      }
      action={
        <Button variant="outline" onClick={onReset}>
          {saved ? 'Перейти к событиям' : 'Сбросить фильтры'}
        </Button>
      }
    />
  )
}
