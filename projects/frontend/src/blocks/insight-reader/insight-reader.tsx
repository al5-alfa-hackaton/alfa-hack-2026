import { useEffect, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { roles, featureLabel, relevanceReason } from '@/entities/company'
import { useTrace, type Insight } from '@/entities/insight'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SaveButton } from '@/blocks/news-feed'
import { ConversationPanel } from './conversation-panel'
import { SourcesPanel } from './sources-panel'
import { FeedbackPanel } from './feedback-panel'

function TracePanel({ item }: { item: Insight }) {
  const trace = useTrace(item)
  const labels: Record<string, string> = {
    'run.queued': 'Задание принято',
    'run.completed': 'Анализ завершён',
    'run.partial': 'Анализ завершён с ограничениями',
    'run.failed': 'Анализ не завершён',
    'run.cancelled': 'Анализ отменён',
    'run.progress': 'Состояние задания обновлено',
    'run.resuming': 'Анализ восстановлен после прерывания',
    'step.started': 'Начат этап анализа',
    'tool.completed': 'Источник данных обработан',
    'model.completed': 'Ответ модели получен',
  }
  return (
    <section aria-label="Журнал анализа">
      {trace.isPending && <RequestSkeleton />}
      {trace.error && (
        <RequestError message={errorMessage(trace.error)} onRetry={() => void trace.refetch()} />
      )}
      <ol className="space-y-5">
        {trace.data?.items.map((event) => (
          <li key={event.id} className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums text-muted-foreground">
              {event.sequence}
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">
                {labels[event.type] ?? 'Событие анализа'}
              </p>
              <time dateTime={event.at} className="text-xs text-muted-foreground">
                {new Date(event.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК
              </time>
              {typeof event.payload.message === 'string' && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {event.payload.message}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {trace.data && !trace.data.items.length && (
        <p className="text-sm text-muted-foreground">Журнал этого анализа недоступен.</p>
      )}
    </section>
  )
}
export function InsightReader({
  item,
  open,
  onClosed,
  onClose,
  onRestoreFocus,
}: {
  item: Insight
  open: boolean
  onClosed: () => void
  onClose: () => void
  onRestoreFocus: () => void
}) {
  const { session, company, context } = useWorkspace()
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const resize = () => {
      if (!sheet.current) return
      sheet.current.style.height = `${viewport.height}px`
      sheet.current.style.top = `${viewport.offsetTop}px`
    }
    resize()
    viewport.addEventListener('resize', resize)
    viewport.addEventListener('scroll', resize)
    return () => {
      viewport.removeEventListener('resize', resize)
      viewport.removeEventListener('scroll', resize)
    }
  }, [])
  const [tab, setTab] = useState('analysis')
  const [source, setSource] = useState<string>()
  const featureLabels = new Map(context.data?.features.map((f) => [f.id, f.label]))
  const claims = (kind: Insight['claims'][number]['kind']) =>
    item.claims.filter((c) => c.kind === kind)
  function claimSection(kind: Insight['claims'][number]['kind'], title: string) {
    const list = claims(kind)
    return (
      <section className={kind === 'ai_inference' ? 'impact-note' : ''}>
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        {list.length ? (
          list.map((claim) => (
            <div key={claim.id} className="mb-4 space-y-2">
              <p className="text-sm leading-7">
                {claim.text}
                {claim.evidenceIds.map((id) => (
                  <Button
                    key={id}
                    variant="link"
                    className="h-auto px-1 text-xs"
                    onClick={() => {
                      setSource(id)
                      setTab('sources')
                    }}
                    aria-label={'Открыть источник ' + id}
                  >
                    [{id}]
                  </Button>
                ))}
              </p>
              {!!claim.companyFeatureIds.length && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Признаки:{' '}
                  {claim.companyFeatureIds
                    .map((id) => featureLabel(id, featureLabels.get(id)))
                    .join(', ')}
                </p>
              )}
              {claim.uncertainty && (
                <p className="text-xs leading-5 text-muted-foreground">{claim.uncertainty}</p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            {kind === 'bank_position'
              ? 'Подтверждённая позиция банка для этого события отсутствует.'
              : 'Подтверждённых данных для этого вывода недостаточно.'}
          </p>
        )}
      </section>
    )
  }
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <SheetContent
        ref={sheet}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onRestoreFocus()
          onClosed()
        }}
        className="reader-sheet h-dvh w-full gap-0 overflow-hidden p-0 sm:max-w-[820px]"
      >
        <SheetHeader className="shrink-0 gap-2 border-b px-5 py-4 pr-14 sm:px-9 sm:pr-14">
          <p className="text-xs text-muted-foreground">
            Сформировано{' '}
            {new Date(item.generatedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК
          </p>
          <SheetTitle className="line-clamp-3 max-w-2xl text-lg font-semibold leading-6 tracking-tight sm:text-xl sm:leading-7">
            {item.event.title}
          </SheetTitle>
          <SheetDescription>
            {company?.displayName} · {roles[session.role]}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
            <TabsList className="reader-tabs m-0 h-12 w-full shrink-0 justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent px-5 sm:gap-7 sm:px-9">
              <TabsTrigger value="analysis">Разбор</TabsTrigger>
              <TabsTrigger value="sources">
                Источники
                <span className="ml-1.5 text-muted-foreground">{item.evidence.length}</span>
              </TabsTrigger>
              <TabsTrigger value="trace">Ход анализа</TabsTrigger>
              <TabsTrigger value="questions">Вопросы</TabsTrigger>
            </TabsList>
            <TabsContent
              value="analysis"
              className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-9 space-y-6"
            >
              {item.status !== 'complete' && (
                <Badge variant="outline">Разбор с ограничениями</Badge>
              )}
              <section className="rounded-xl bg-muted/40 p-4">
                <h3 className="mb-2 text-sm font-semibold">Главное для вашей компании</h3>
                <p className="text-sm leading-7">{item.summary}</p>
              </section>
              {claimSection('fact', 'Что произошло')}
              {claimSection('ai_inference', 'AI-интерпретация для вашей компании')}
              <section>
                <h3 className="mb-2 text-sm font-semibold">Почему это важно</h3>
                <ul className="space-y-2 text-sm leading-6" aria-label="Основания приоритета">
                  {item.relevance.reasons.map((reason) => (
                    <li key={reason}>{relevanceReason(reason)}</li>
                  ))}
                  {item.relevance.explanations?.map((reason, index) => (
                    <li key={index}>
                      {featureLabel(reason.featureId, featureLabels.get(reason.featureId))}:{' '}
                      {reason.signal}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Приоритет {item.relevance.rank} · Релевантность{' '}
                  {Math.round(item.relevance.score * 100)}/100
                </p>
              </section>
              {[
                ['Риски', item.risks],
                ['Возможности', item.opportunities],
                ['Возможные следующие шаги', item.actions],
              ].map(([title, lines]) => (
                <section key={String(title)}>
                  <h3 className="mb-2 text-sm font-semibold">{title}</h3>
                  {(lines as string[]).length ? (
                    <ul className="space-y-2 text-sm leading-7">
                      {(lines as string[]).map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-7 text-muted-foreground">
                      Не выделены по доступным данным.
                    </p>
                  )}
                </section>
              ))}
              {claimSection('bank_position', 'Позиция банка')}
              {item.bankPosition.status !== 'available' && (
                <p className="text-xs leading-5 text-muted-foreground">
                  {item.bankPosition.status === 'stale'
                    ? 'Доступные материалы банка устарели.'
                    : item.bankPosition.status === 'conflicting'
                      ? 'Материалы банка содержат противоречия.'
                      : 'AI-интерпретация не является позицией банка.'}
                </p>
              )}
              {!!(item.missingData.length + item.limitations.length) && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold">Ограничения и неизвестные данные</h3>
                  <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                    {[...new Set([...item.missingData, ...item.limitations])].map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setTab('questions')}>
                  <MessageSquare className="size-4" />
                  Уточнить влияние
                </Button>
                <SaveButton item={item} />
              </div>
              <FeedbackPanel item={item} />
            </TabsContent>
            <TabsContent
              value="sources"
              className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-9"
            >
              <SourcesPanel item={item} selectedSource={source} />
            </TabsContent>
            <TabsContent
              value="trace"
              className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-9"
            >
              <TracePanel item={item} />
            </TabsContent>
            <TabsContent value="questions" className="min-h-0 overflow-hidden">
              <ConversationPanel item={item} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
