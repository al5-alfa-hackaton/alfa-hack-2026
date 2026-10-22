import { useState } from 'react'
import { Bookmark, MessageSquare } from 'lucide-react'
import { companies, roles } from '@/entities/company'
import { steps } from '@/entities/analysis'
import type { News } from '@/entities/insight'
import { scopeKey, useWorkspace } from '@/entities/workspace'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConversationPanel } from './conversation-panel'
import { SourcesPanel } from './sources-panel'
import { FeedbackPanel } from './feedback-panel'

export function InsightReader({
  item,
  onClose,
  onRestoreFocus,
}: {
  item: News
  onClose: () => void
  onRestoreFocus: () => void
}) {
  const { session, setSession } = useWorkspace()
  const [tab, setTab] = useState('analysis')
  const context = item.context[session.company]
  const company = companies[session.company]
  const key = scopeKey(session.company, session.role, item.id)
  const saved = session.saved.includes(key)
  return (
    <Sheet
      open
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onRestoreFocus()
        }}
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[820px]"
      >
        <SheetHeader className="gap-3 border-b px-5 pb-5 pr-14 pt-7 sm:px-9 sm:pr-14">
          <p className="text-xs text-muted-foreground">{item.category} · 21 октября 2026 · Демо</p>
          <SheetTitle className="max-w-2xl text-2xl font-semibold leading-8 tracking-tight">
            {item.title}
          </SheetTitle>
          <SheetDescription>
            {company.name} · {roles[session.role]}
          </SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-7 sm:px-9">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="reader-tabs mb-7 mt-2 h-12 w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0 sm:gap-7">
              <TabsTrigger value="analysis">Разбор</TabsTrigger>
              <TabsTrigger value="sources">
                Источники<span className="ml-1.5 text-muted-foreground">{item.bank ? 3 : 2}</span>
              </TabsTrigger>
              <TabsTrigger value="trace">Ход анализа</TabsTrigger>
              <TabsTrigger value="questions">Вопросы</TabsTrigger>
            </TabsList>
            <TabsContent value="analysis" className="space-y-6">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Что произошло</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {item.fact}
                  <button
                    className="ml-1.5 text-xs font-medium text-foreground underline underline-offset-4"
                    aria-label="Открыть источник новости"
                    onClick={() => setTab('sources')}
                  >
                    [1]
                  </button>
                </p>
              </section>
              <section className="impact-note">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Что это меняет для вас</h3>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    AI-интерпретация · демо
                  </Badge>
                </div>
                <p className="text-base leading-7">{context.impact}</p>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Основание: {context.reason}
                  <button
                    className="ml-1.5 text-foreground underline underline-offset-4"
                    aria-label="Открыть профиль-источник"
                    onClick={() => setTab('sources')}
                  >
                    [2]
                  </button>
                </p>
              </section>
              <div className="grid gap-6 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="size-1.5 rounded-full bg-destructive" />
                    Риски
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">{context.risk}</p>
                </section>
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="size-1.5 rounded-full bg-positive" />
                    Возможности
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">{context.opportunity}</p>
                </section>
              </div>
              <section className="border-y py-5">
                <h3 className="mb-2 text-sm font-semibold">Возможный следующий шаг</h3>
                <p className="text-sm leading-7">{context.action}</p>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Позиция банка</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {item.bank ??
                    'Материал банка для этого события не подключён. Интерпретация выше не является позицией банка.'}
                </p>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Что остаётся неизвестным</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {company.missing} Количественный эффект не рассчитывается.
                </p>
              </section>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setTab('questions')}>
                  <MessageSquare className="size-4" />
                  Уточнить влияние
                </Button>
                <Button
                  variant="outline"
                  aria-pressed={saved}
                  onClick={() =>
                    setSession((s) => ({
                      ...s,
                      saved: saved ? s.saved.filter((k) => k !== key) : [...s.saved, key],
                    }))
                  }
                >
                  <Bookmark className={`size-4 ${saved ? 'fill-current' : ''}`} />
                  {saved ? 'Сохранено' : 'Сохранить'}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="sources">
              <SourcesPanel item={item} />
            </TabsContent>
            <TabsContent value="trace">
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                Сценарная последовательность, не журнал реального агента. Модель и инструменты не
                вызывались.
              </p>
              <ol className="space-y-6">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-medium">{step}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {
                          [
                            context.reason,
                            `Событие сопоставлено с отраслью и ролью «${roles[session.role]}».`,
                            item.bank
                              ? 'Сопоставлены учебная новость, профиль и демо-аналитика.'
                              : 'Материал банка отсутствует. Позиция банка не сформирована.',
                            company.missing,
                          ][index]
                        }
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="questions">
              <ConversationPanel item={item} />
            </TabsContent>
          </Tabs>
          <FeedbackPanel insightId={item.id} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
