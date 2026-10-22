import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Loader2, MessageSquare } from 'lucide-react'
import { askQuestion, useConversation, type Insight } from '@/entities/insight'
import { runActive, useRunHistory, useCancelRun } from '@/entities/analysis'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ConversationPanel({ item }: { item: Insight }) {
  const { user } = useWorkspace()
  const cache = useQueryClient()
  const history = useRunHistory(item.companyId, item.perspective)
  const runs =
    history.data?.pages
      .flatMap((page) => page.items)
      .filter((run) => run.input.insightId === item.id) ?? []
  const active = runs.find((run) => runActive(run.status))
  const latest = runs[0]
  const conversation = useConversation(item, !!active)
  const messages = conversation.data?.items ?? []
  const [question, setQuestion] = useState('')
  const request = useRef<{ question: string; key: string } | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const cancel = useCancelRun()
  const ask = useMutation({
    mutationFn: (prompt: string) => {
      if (request.current?.question !== prompt)
        request.current = { question: prompt, key: crypto.randomUUID() }
      return askQuestion(item, prompt, request.current.key)
    },
    onSuccess: async () => {
      request.current = null
      setQuestion('')
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['history', item.companyId, item.perspective] }),
        cache.invalidateQueries({ queryKey: ['conversation', item.id, item.perspective] }),
      ])
    },
  })
  useEffect(() => {
    if (latest && !runActive(latest.status))
      void cache.invalidateQueries({ queryKey: ['conversation', item.id, item.perspective] })
  }, [cache, item.id, item.perspective, latest?.id, latest?.status])
  const busy = ask.isPending || !!active
  const disabled = busy || history.isPending || !!history.error || user?.analysisAvailable === false
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, busy])
  const error = ask.error ?? cancel.error ?? conversation.error ?? history.error
  return (
    <section aria-label="Уточнение анализа">
      <div className="mb-5">
        <h3 className="text-base font-semibold">Уточните влияние события</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Вопрос и ответ сохранятся в контексте вашей компании и этой версии разбора.
        </p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {['Почему это важно?', 'Какие риски?', 'Что сделать?', 'На чём основан вывод?'].map(
          (prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setQuestion(prompt)
                ask.mutate(prompt)
              }}
              className="h-9 text-xs"
            >
              {prompt}
            </Button>
          ),
        )}
      </div>
      {error && (
        <RequestError
          message={errorMessage(error)}
          onRetry={() => {
            void conversation.refetch()
            void history.refetch()
          }}
        />
      )}
      {latest?.status === 'failed' && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {latest.error ?? 'Не удалось подготовить ответ. Повторите вопрос.'}
        </p>
      )}
      <ScrollArea className="h-[min(40vh,360px)] rounded-lg border bg-muted/25 p-4">
        <div role="log" aria-live="polite" aria-label="Диалог по событию" className="space-y-5">
          {conversation.isPending && <RequestSkeleton />}
          {conversation.isSuccess && !messages.length && (
            <div className="py-8 text-sm leading-6 text-muted-foreground">
              <MessageSquare className="mb-4 size-5" />
              <p>Задайте вопрос о рисках, возможностях или основаниях вывода.</p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                'max-w-[92%] text-sm leading-6 ' +
                (message.author === 'user' ? 'ml-auto rounded-lg bg-secondary px-4 py-3' : 'pr-3')
              }
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {message.author === 'user' ? 'Вы' : 'Аналитик'}
              </p>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </div>
          ))}
          {busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {active?.status === 'cancelling' ? 'Отменяем ответ…' : 'Готовим ответ…'}
            </p>
          )}
          <div ref={end} />
        </div>
      </ScrollArea>
      {active && (
        <Button
          variant="ghost"
          className="mt-2"
          disabled={cancel.isPending || active.status === 'cancelling'}
          onClick={() => cancel.mutate(active.id)}
        >
          Отменить ответ
        </Button>
      )}
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (question.trim() && !busy) ask.mutate(question.trim())
        }}
      >
        <Label htmlFor="insight-question" className="mb-2 block">
          Ваш вопрос
        </Label>
        <div className="relative">
          <Textarea
            id="insight-question"
            maxLength={1000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Что это меняет для нашей компании?"
            disabled={disabled}
            className="min-h-24 resize-none pr-14"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-3 right-3 size-8"
            aria-label="Отправить вопрос"
            disabled={!question.trim() || disabled}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Ответ может содержать ошибки. Проверяйте источники и ограничения анализа.
        </p>
      </form>
    </section>
  )
}
