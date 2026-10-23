import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { roles, relevanceReason } from '@/entities/company'
import { runErrorMessage } from '@/entities/analysis'
import { useFeed, useInsight, type Kind, type Insight } from '@/entities/insight'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeading } from '@/components/page-heading'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { AnalysisProgress, useAnalysis } from '@/blocks/analysis-control'
import { FeedContext, NewsFilters, NewsRow, NoNews } from '@/blocks/news-feed'
import { InsightReader } from '@/blocks/insight-reader'
import { exportDigest } from './export-digest'

export function FeedPage({ saved = false }: { saved?: boolean }) {
  const { session, company, user } = useWorkspace()
  const { insight } = useSearch({ strict: false })
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const input = useRef<HTMLInputElement>(null)
  const analysis = useAnalysis()
  const feed = useFeed(session.company, session.role, saved)
  const detail = useInsight(insight, session.role)
  const items = feed.data?.pages.flatMap((page) => page.items) ?? []
  const emptySaved = saved && feed.isSuccess && !items.length
  const emptyFeed = !saved && feed.isSuccess && !items.length
  const refreshDisabled =
    analysis.running ||
    analysis.history.isPending ||
    !!analysis.history.error ||
    user?.analysisAvailable === false
  const lastUpdated = items.reduce(
    (latest, item) => (item.generatedAt > latest ? item.generatedAt : latest),
    '',
  )
  const search = query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const filtered = items.filter(
    (item) =>
      (filter === 'all' || item.kind === filter) &&
      (
        item.event.title +
        ' ' +
        item.summary +
        ' ' +
        item.relevance.reasons.map(relevanceReason).join(' ')
      )
        .toLocaleLowerCase('ru')
        .replaceAll('ё', 'е')
        .includes(search),
  )
  const selected =
    detail.data?.insight.companyId === session.company ? detail.data.insight : undefined
  const [closingItem, setClosingItem] = useState<Insight>()
  useEffect(() => {
    if (selected) setClosingItem(selected)
  }, [selected])
  const readerItem =
    selected ??
    (closingItem?.companyId === session.company && closingItem.perspective === session.role
      ? closingItem
      : undefined)
  const counts = {
    all: items.length,
    risk: items.filter((i) => i.kind === 'risk').length,
    opportunity: items.filter((i) => i.kind === 'opportunity').length,
    context: items.filter((i) => i.kind === 'context').length,
  }
  useEffect(() => {
    setQuery('')
    setFilter('all')
  }, [session.company, session.role, saved])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!insight && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [insight])
  function open(id?: string) {
    void navigate({
      to: saved ? '/saved' : '/',
      search: id ? { insight: id } : {},
      resetScroll: false,
    })
  }
  return (
    <>
      <PageHeading
        title={saved ? 'Сохранённые события' : 'События для вашего бизнеса'}
        description={
          saved
            ? company?.displayName + ' · ' + roles[session.role]
            : 'Что изменилось на рынке и почему это важно для вашей компании.'
        }
        action={
          !saved &&
          !emptyFeed && (
            <Button
              disabled={refreshDisabled}
              onClick={() => {
                open()
                analysis.analyze()
              }}
            >
              <RefreshCw className={'size-4 ' + (analysis.running ? 'animate-spin' : '')} />
              Обновить сводку
            </Button>
          )
        }
      />
      {!saved && user?.analysisAvailable === false && (
        <Alert className="mb-6">
          <AlertTitle>Анализ пока недоступен</AlertTitle>
          <AlertDescription>
            Администратору нужно подключить сервис анализа. Профиль, история и готовые разборы
            доступны.
          </AlertDescription>
        </Alert>
      )}
      {!saved && analysis.running && (
        <AnalysisProgress
          run={analysis.run}
          onCancel={analysis.cancel}
          cancelling={analysis.cancelling}
          firstRun={emptyFeed}
        />
      )}
      {!saved && analysis.error && <RequestError message={errorMessage(analysis.error)} />}
      {!saved && analysis.history.error && (
        <RequestError
          message={errorMessage(analysis.history.error)}
          onRetry={() => void analysis.history.refetch()}
        />
      )}
      {!saved && analysis.latest?.status === 'failed' && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Не удалось обновить сводку</AlertTitle>
          <AlertDescription>{runErrorMessage(analysis.latest.error)}</AlertDescription>
        </Alert>
      )}
      {!saved && analysis.latest?.status === 'partial' && (
        <Alert className="mb-6">
          <AlertTitle>Сводка сформирована с ограничениями</AlertTitle>
          <AlertDescription>
            Проверьте доступность источников и оговорки в разборах.
          </AlertDescription>
        </Alert>
      )}
      {feed.error && (
        <RequestError message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />
      )}
      {emptyFeed && !analysis.running && user?.analysisAvailable !== false && (
        <section
          aria-label="Начать подбор новостей"
          className="state-enter flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center"
        >
          {analysis.latest && ['completed', 'partial'].includes(analysis.latest.status) && (
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Подходящих событий пока нет. Попробуйте обновить новости позже.
            </p>
          )}
          <Button
            variant="ghost"
            size="lg"
            className="refresh-news-action h-auto flex-col gap-4 rounded-2xl px-8 py-6 text-lg font-medium text-primary dark:text-[#ff8075]"
            disabled={refreshDisabled}
            onClick={() => {
              open()
              analysis.analyze()
            }}
          >
            <RefreshCw aria-hidden="true" className="refresh-news-icon size-12" strokeWidth={1.5} />
            Обновить новости
          </Button>
        </section>
      )}
      {!emptyFeed && (
        <div
          className={
            emptySaved
              ? 'flex min-h-60 flex-1 flex-col'
              : 'grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_248px]'
          }
        >
          <section
            className={emptySaved ? 'flex min-w-0 flex-1 flex-col' : 'min-w-0'}
            aria-label={saved ? 'Сохранённые события' : 'Персональная лента'}
          >
            {!!items.length && (
              <NewsFilters
                filter={filter}
                onFilter={setFilter}
                query={query}
                onQuery={setQuery}
                counts={counts}
                inputRef={input}
                onExport={() =>
                  exportDigest(filtered, company?.displayName ?? session.company, session.role)
                }
                canExport={!!filtered.length && !feed.isPending}
              />
            )}
            {lastUpdated && (
              <p className="py-2 text-xs text-muted-foreground">
                Обновлено{' '}
                {new Date(lastUpdated).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК
              </p>
            )}
            {feed.isPending ? (
              <RequestSkeleton />
            ) : filtered.length ? (
              filtered.map((item, index) => (
                <NewsRow key={item.id} item={item} lead={index === 0 && !saved} onOpen={open} />
              ))
            ) : (
              !feed.error && (
                <NoNews
                  saved={saved && !items.length}
                  query={query}
                  onReset={() => {
                    setQuery('')
                    setFilter('all')
                    if (saved && !items.length) void navigate({ to: '/', search: {} })
                  }}
                />
              )
            )}
            {feed.hasNextPage && (
              <Button
                variant="outline"
                className="mt-5"
                disabled={feed.isFetchingNextPage}
                onClick={() => void feed.fetchNextPage()}
              >
                Показать ещё
              </Button>
            )}
            {!!items.length && (
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                {filtered.length} из {items.length} загруженных событий · Приоритет учитывает
                компанию и роль
              </p>
            )}
          </section>
          {!!items.length && <FeedContext />}
        </div>
      )}
      {insight && detail.isPending && (
        <p role="status" className="mt-4 text-sm">
          Загрузка разбора…
        </p>
      )}
      {insight && detail.error && (
        <RequestError message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
      )}
      {readerItem && (
        <InsightReader
          key={session.company + session.role + readerItem.id}
          item={readerItem}
          open={!!selected}
          onClosed={() => {
            if (!selected) setClosingItem(undefined)
          }}
          onClose={() => open()}
          onRestoreFocus={() =>
            document
              .querySelector<HTMLButtonElement>('[data-event-title="' + readerItem.id + '"]')
              ?.focus()
          }
        />
      )}
    </>
  )
}
