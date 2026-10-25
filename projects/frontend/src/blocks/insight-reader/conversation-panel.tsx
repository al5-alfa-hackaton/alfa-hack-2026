import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Loader2, MessageSquare, Square } from 'lucide-react'
import { askQuestion, useConversation, type Insight } from '@/entities/insight'
import { runActive, useRunHistory, useCancelRun } from '@/entities/analysis'
import { useWorkspace } from '@/entities/workspace'
import { errorMessage } from '@/shared/lib'
import { RequestError, RequestSkeleton } from '@/components/request-state'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChatContainerRoot, ChatContainerContent } from '@/components/prompt-kit/chat-container'
import { ScrollButton } from '@/components/prompt-kit/scroll-button'

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
  const error = ask.error ?? cancel.error ?? conversation.error ?? history.error
  return (
    <section aria-label="Уточнение анализа" className="flex h-full min-h-0 flex-col">
      <ChatContainerRoot aria-label="Диалог по событию" aria-live="polite">
        <ChatContainerContent className="gap-5 px-5 py-6 sm:px-9">
          {!messages.length && (
            <div>
              <h3 className="text-base font-semibold">Уточните влияние события</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Вопрос и ответ сохранятся в контексте вашей компании и этой версии разбора.
              </p>
            </div>
          )}
          {!messages.length && (
            <div className="flex flex-wrap gap-2">
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
          )}
          {user?.analysisAvailable === false && (
            <p role="status" className="text-sm text-muted-foreground">
              Новые ответы пока недоступны. Сохранённый диалог можно читать.
            </p>
          )}
          {error && (
            <RequestError
              message={errorMessage(error)}
              onRetry={() => {
                if (ask.error && question.trim() && !disabled) {
                  ask.mutate(question.trim())
                  return
                }
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
          <div className="space-y-5">
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
          </div>
        </ChatContainerContent>
        <div className="pointer-events-none absolute bottom-3 right-5 [&>button]:pointer-events-auto">
          <ScrollButton />
        </div>
      </ChatContainerRoot>
      <form
        className="shrink-0 border-t bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-9"
        onSubmit={(event) => {
          event.preventDefault()
          if (question.trim() && !disabled) ask.mutate(question.trim())
        }}
      >
        <Label htmlFor="insight-question" className="sr-only">
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
            className="min-h-16 max-h-36 resize-none rounded-2xl bg-muted/40 pr-14 field-sizing-content"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute bottom-3 right-3 size-8 rounded-full"
              aria-label="Остановить ответ"
              title={
                cancel.isPending || active?.status === 'cancelling'
                  ? 'Останавливаем ответ…'
                  : 'Остановить ответ'
              }
              disabled={!active || cancel.isPending || active.status === 'cancelling'}
              onClick={() => {
                if (active) cancel.mutate(active.id)
              }}
            >
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="absolute bottom-3 right-3 size-8 rounded-full"
              aria-label="Отправить вопрос"
              disabled={!question.trim() || disabled}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Enter — отправить · Shift+Enter — новая строка. Проверяйте источники ответа.
        </p>
      </form>
    </section>
  )
}
