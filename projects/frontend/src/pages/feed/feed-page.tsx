import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { roles, relevanceReason } from '@/entities/company'
import { runErrorMessage } from '@/entities/analysis'
import { useFeed, useInsight, type Kind } from '@/entities/insight'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeading } from '@/components/page-heading'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { EmptyState } from '@/components/empty-state'
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
          !saved && (
            <Button
              disabled={
                analysis.running ||
                analysis.history.isPending ||
                !!analysis.history.error ||
                user?.analysisAvailable === false
              }
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
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_248px]">
        <section
          className="min-w-0"
          aria-label={saved ? 'Сохранённые события' : 'Персональная лента'}
        >
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
          {feed.isPending ? (
            <RequestSkeleton />
          ) : filtered.length ? (
            filtered.map((item, index) => (
              <NewsRow key={item.id} item={item} lead={index === 0 && !saved} onOpen={open} />
            ))
          ) : (
            !feed.error &&
            (!saved && !items.length ? (
              <EmptyState
                title="Сводка ещё не сформирована"
                description={
                  user?.analysisAvailable === false
                    ? 'Готовые разборы появятся здесь после подключения сервиса анализа.'
                    : 'Обновите сводку, чтобы найти события, значимые для вашей компании.'
                }
              />
            ) : (
              <NoNews
                saved={saved}
                query={query}
                onReset={() => {
                  setQuery('')
                  setFilter('all')
                  if (saved) void navigate({ to: '/', search: {} })
                }}
              />
            ))
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
              {filtered.length} из {items.length} загруженных событий · Приоритет учитывает компанию
              и роль
            </p>
          )}
        </section>
        <FeedContext />
      </div>
      {insight && detail.isPending && (
        <p role="status" className="mt-4 text-sm">
          Загрузка разбора…
        </p>
      )}
      {insight && detail.error && (
        <RequestError message={errorMessage(detail.error)} onRetry={() => void detail.refetch()} />
      )}
      {selected && (
        <InsightReader
          key={session.company + session.role + selected.id}
          item={selected}
          onClose={() => open()}
          onRestoreFocus={() =>
            document
              .querySelector<HTMLButtonElement>('[data-event-title="' + selected.id + '"]')
              ?.focus()
          }
        />
      )}
    </>
  )
}
