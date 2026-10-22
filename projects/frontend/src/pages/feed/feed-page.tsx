import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { RefreshCw } from 'lucide-react'
import { companies, roles } from '@/entities/company'
import { rankedNews, type Kind } from '@/entities/insight'
import { scopeKey, useWorkspace } from '@/entities/workspace'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeading } from '@/components/page-heading'
import { EmptyState } from '@/components/empty-state'
import { AnalysisProgress, DemoScenarios, useAnalysis } from '@/blocks/analysis-control'
import { FeedContext, NewsFilters, NewsRow, NoNews } from '@/blocks/news-feed'
import { InsightReader } from '@/blocks/insight-reader'
import { exportDigest } from './export-digest'

export function FeedPage({ saved = false }: { saved?: boolean }) {
  const { session } = useWorkspace()
  const { insight } = useSearch({ strict: false })
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const input = useRef<HTMLInputElement>(null)
  const analysis = useAnalysis()
  const items = rankedNews(session.company, session.role).filter(
    (item) => !saved || session.saved.includes(scopeKey(session.company, session.role, item.id)),
  )
  const filtered = items.filter(
    (item) =>
      (filter === 'all' || item.kind === filter) &&
      `${item.title} ${item.category} ${item.context[session.company].reason}`
        .toLocaleLowerCase('ru')
        .replaceAll('ё', 'е')
        .includes(query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')),
  )
  const selected = items.find((item) => item.id === insight)
  const counts = {
    all: items.length,
    risk: items.filter((i) => i.kind === 'risk').length,
    opportunity: items.filter((i) => i.kind === 'opportunity').length,
    watch: items.filter((i) => i.kind === 'watch').length,
  }
  useEffect(() => {
    setQuery('')
    setFilter('all')
  }, [session.company, session.role, saved])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!selected && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])
  function open(id?: string) {
    void navigate({
      to: saved ? '/saved' : '/',
      search: id ? { insight: id } : {},
      resetScroll: false,
    })
  }
  const unavailable = !saved && (!!analysis.error || analysis.result === 'empty')
  return (
    <>
      <PageHeading
        title={saved ? 'Сохранённые события' : 'События для вашего бизнеса'}
        description={
          saved
            ? `${companies[session.company].name} · ${roles[session.role]}`
            : 'Что изменилось на рынке и почему это важно для вашей компании.'
        }
        action={
          !saved && (
            <>
              <DemoScenarios
                value={analysis.scenario}
                onChange={analysis.setScenario}
                onRun={(mode) => {
                  open()
                  void analysis.analyze(mode)
                }}
                disabled={analysis.running}
              />
              <Button
                disabled={analysis.running}
                onClick={() => {
                  open()
                  void analysis.analyze()
                }}
              >
                <RefreshCw className={`size-4 ${analysis.running ? 'animate-spin' : ''}`} />
                Обновить сводку
              </Button>
            </>
          )
        }
      />
      {analysis.running && <AnalysisProgress step={analysis.step} onCancel={analysis.cancel} />}
      {!saved && analysis.error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>
            {analysis.error === 'budget'
              ? 'Лимит анализа исчерпан'
              : analysis.error === 'denied'
                ? 'Нет доступа к источнику'
                : 'Не удалось обновить сводку'}
          </AlertTitle>
          <AlertDescription>
            <p>
              {analysis.error === 'budget'
                ? 'Учебный сценарий ограничения бюджета. Средства не расходуются.'
                : analysis.error === 'denied'
                  ? 'Источник недоступен в выбранном сценарии. Его данные не раскрываются.'
                  : 'Сервис не ответил. Попробуйте запустить обычный сценарий.'}
            </p>
            <Button
              variant="outline"
              className="mt-3 w-fit"
              disabled={analysis.running}
              onClick={() => void analysis.analyze('normal')}
            >
              Повторить обычный анализ
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!saved && analysis.result === 'partial' && !analysis.error && (
        <Alert className="mb-6">
          <AlertTitle>Сводка обновлена по доступным источникам</AlertTitle>
          <AlertDescription>
            Один учебный источник недоступен. Позиция банка не обновлялась; полнота интерпретаций
            ограничена.
          </AlertDescription>
        </Alert>
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
            counts={unavailable ? { all: 0, risk: 0, opportunity: 0, watch: 0 } : counts}
            inputRef={input}
            onExport={() => exportDigest(filtered, session.company, session.role)}
            canExport={!unavailable && !analysis.running && !!filtered.length}
          />
          {unavailable ? (
            !analysis.error && (
              <EmptyState
                title="Новых событий пока нет"
                description="В этом учебном сценарии источники не вернули событий. Можно восстановить обычную сводку."
                action={
                  <Button variant="outline" onClick={() => void analysis.analyze('normal')}>
                    Вернуться к обычной сводке
                  </Button>
                }
              />
            )
          ) : filtered.length ? (
            <div>
              {filtered.map((item, index) => (
                <NewsRow key={item.id} item={item} lead={index === 0 && !saved} onOpen={open} />
              ))}
            </div>
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
          )}
          {!unavailable && (
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              {filtered.length} из {items.length} событий · Порядок учитывает компанию и роль
            </p>
          )}
        </section>
        <FeedContext />
      </div>
      {selected && !unavailable && (
        <InsightReader
          key={scopeKey(session.company, session.role, selected.id)}
          item={selected}
          onClose={() => open()}
          onRestoreFocus={() =>
            document
              .querySelector<HTMLButtonElement>(`[data-event-title="${selected.id}"]`)
              ?.focus()
          }
        />
      )}
    </>
  )
}
