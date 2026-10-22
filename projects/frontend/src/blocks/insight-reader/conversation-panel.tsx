import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, MessageSquare } from 'lucide-react'
import { answerQuestion, type News } from '@/entities/insight'
import { scopeKey, useWorkspace } from '@/entities/workspace'
import { delay } from '@/shared/lib'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ConversationPanel({ item }: { item: News }) {
  const { session, setSession } = useWorkspace()
  const key = scopeKey(session.company, session.role, item.id)
  const messages = session.chats[key] ?? []
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [messages.length, busy])
  const full = messages.length >= 39
  async function ask(text: string) {
    const prompt = text.trim()
    if (!prompt || prompt.length > 1000 || controller.current || full) return
    const ac = new AbortController()
    controller.current = ac
    setBusy(true)
    setQuestion('')
    setSession((s) => ({
      ...s,
      chats: { ...s.chats, [key]: [...(s.chats[key] ?? []), { author: 'user', text: prompt }] },
    }))
    try {
      await delay(600, ac.signal)
      const answer = answerQuestion(prompt, item, session.company, session.role)
      setSession((s) => ({
        ...s,
        chats: {
          ...s.chats,
          [key]: [...(s.chats[key] ?? []), { author: 'assistant', text: answer }],
        },
      }))
    } catch {
      setSession((s) => ({
        ...s,
        chats: {
          ...s.chats,
          [key]: [
            ...(s.chats[key] ?? []),
            { author: 'assistant', text: 'Ответ отменён. Вы можете задать вопрос снова.' },
          ],
        },
      }))
    } finally {
      controller.current = null
      if (!ac.signal.aborted) setBusy(false)
    }
  }
  return (
    <section aria-label="Уточнение анализа">
      <div className="mb-5">
        <h3 className="text-base font-semibold">Посмотрим на событие с другой стороны</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Задайте вопрос о влиянии, рисках или следующем шаге. Ответ останется в контексте этой
          компании.
        </p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {['Почему это важно?', 'Какие риски?', 'Что сделать?', 'На чём основан вывод?'].map((q) => (
          <Button
            key={q}
            variant="outline"
            size="sm"
            disabled={busy || full}
            onClick={() => void ask(q)}
            className="h-9 text-xs"
          >
            {q}
          </Button>
        ))}
      </div>
      <ScrollArea className="h-[min(40vh,360px)] rounded-lg border bg-muted/25 p-4">
        <div role="log" aria-live="polite" aria-label="Диалог по событию" className="space-y-5">
          {!messages.length && (
            <div className="py-8 text-sm leading-6 text-muted-foreground">
              <MessageSquare className="mb-4 size-5" />
              <p>Например: что проверить в кредитных договорах перед рефинансированием?</p>
              <p className="mt-2">
                В демо доступны сценарные ответы. Языковая модель не подключена.
              </p>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[92%] text-sm leading-6 ${message.author === 'user' ? 'ml-auto rounded-lg bg-secondary px-4 py-3' : 'pr-3'}`}
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {message.author === 'user' ? 'Вы' : 'Демо-аналитик'}
              </p>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </div>
          ))}
          {busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Готовим демо-ответ…
            </p>
          )}
          <div ref={end} />
        </div>
      </ScrollArea>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(question)
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
            disabled={busy || full}
            className="min-h-24 resize-none pr-14"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-3 right-3 size-8"
            aria-label="Отправить вопрос"
            disabled={!question.trim() || busy || full}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {full
            ? 'Лимит демо-диалога достигнут — 20 ответов на событие.'
            : 'Сценарные ответы · только в этом браузере · не финансовая рекомендация'}
        </p>
      </form>
    </section>
  )
}
