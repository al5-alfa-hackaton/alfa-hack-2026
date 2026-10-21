import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  FileText,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  answerQuestion,
  companies,
  delay,
  roles,
  scopeKey,
  steps,
  type News,
  type Session,
} from "./model";
import type { Dispatch, SetStateAction } from "react";

export function InsightDetail({
  item,
  session,
  setSession,
  onClose,
}: {
  item: News;
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
  onClose: () => void;
}) {
  const key = scopeKey(session.company, session.role, item.id),
    context = item.context[session.company];
  const [tab, setTab] = useState("analysis"),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const messages = session.chats[key] ?? [];
  function feedback(value: string) {
    setSession((s) => ({ ...s, feedback: { ...s.feedback, [key]: value } }));
  }
  async function ask(text: string) {
    if (!text.trim() || busy || messages.length >= 40) return;
    const prompt = text.trim();
    setQuestion("");
    setBusy(true);
    setSession((s) => ({
      ...s,
      chats: {
        ...s.chats,
        [key]: [...(s.chats[key] ?? []), { author: "user", text: prompt }],
      },
    }));
    const ac = new AbortController();
    controller.current = ac;
    try {
      await delay(600, ac.signal);
      const answer = answerQuestion(
        prompt,
        item,
        session.company,
        session.role,
      );
      setSession((s) => ({
        ...s,
        chats: {
          ...s.chats,
          [key]: [
            ...(s.chats[key] ?? []),
            { author: "assistant", text: answer },
          ],
        },
      }));
    } catch {
      /* Closing the insight cancels only its pending answer. */
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-6xl">
        <SheetHeader className="border-b px-6 pb-6 pr-14 pt-8 sm:px-8 sm:pr-14">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{item.category}</Badge>
            <Badge variant="insight">
              <Sparkles /> Синтетический AI-вывод
            </Badge>
          </div>
          <SheetTitle className="text-2xl leading-tight sm:text-3xl">
            {item.title}
          </SheetTitle>
          <SheetDescription>
            {companies[session.company].name} · {roles[session.role]} ·
            Демо-данные на 21 октября 2026
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-5">
                <TabsTrigger value="analysis">Разбор</TabsTrigger>
                <TabsTrigger value="sources">Источники</TabsTrigger>
                <TabsTrigger value="trace">Как получен вывод</TabsTrigger>
              </TabsList>
              <TabsContent value="analysis" className="space-y-6">
                <section>
                  <h3 className="mb-2 font-semibold">Что произошло</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.fact}
                  </p>
                  <Button
                    variant="link"
                    className="h-auto px-0"
                    onClick={() => setTab("sources")}
                  >
                    Открыть источник <ArrowUpRight />
                  </Button>
                </section>
                <div className="rounded-2xl bg-insight p-5 text-insight-foreground">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4" /> Почему это важно для вас
                  </p>
                  <p className="text-sm leading-6">{context.impact}</p>
                  <Separator className="my-4 bg-white/25" />
                  <p className="text-xs leading-5">
                    Основание: {context.reason}
                  </p>
                </div>
                <section className="space-y-4">
                  <div>
                    <Badge variant="destructive">Риск</Badge>
                    <p className="mt-2 text-sm leading-6">{context.risk}</p>
                  </div>
                  <div>
                    <Badge variant="success">Возможность</Badge>
                    <p className="mt-2 text-sm leading-6">
                      {context.opportunity}
                    </p>
                  </div>
                </section>
                <section className="rounded-xl border p-4">
                  <h3 className="mb-2 font-semibold">
                    Возможный следующий шаг
                  </h3>
                  <p className="text-sm leading-6">{context.action}</p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {session.role === "cfo"
                      ? "Фокус CFO: денежный поток, стоимость капитала, ликвидность."
                      : "Фокус директора: устойчивость бизнеса, стратегия, операционные решения."}
                  </p>
                </section>
                <section>
                  <h3 className="mb-2 font-semibold">Аналитика банка</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.bank ??
                      "Материал банка для этого события не подключён. Позиция банка не сформирована; AI-вывод не заменяет её."}
                  </p>
                </section>
                <section className="rounded-xl bg-muted p-4">
                  <h3 className="mb-2 text-sm font-semibold">
                    Что ещё нужно уточнить
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {companies[session.company].missing} Количественный эффект
                    без этих данных не рассчитывается.
                  </p>
                </section>
              </TabsContent>
              <TabsContent value="sources" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Это встроенные учебные документы. Реальные публикации и
                  банковские материалы не подключены.
                </p>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4" />
                      {item.source}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <Badge variant="outline">Вымышленный первоисточник</Badge>
                    <p className="leading-6">{item.fact}</p>
                    <p className="text-xs text-muted-foreground">
                      Фрагмент 1 · Демо-корпус · 21.10.2026
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Профиль «{companies[session.company].name}»
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6">
                    {context.reason}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Синтетическая карточка компании · версия 1
                    </p>
                  </CardContent>
                </Card>
                {item.bank && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Учебная аналитическая записка
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm leading-6">
                      {item.bank}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              <TabsContent value="trace" className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Демонстрация этапов анализа. Модель и инструменты не
                  вызываются.
                </p>
                {steps.map((step, i) => (
                  <div key={step} className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-sm text-black">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{step}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {
                          [
                            context.reason,
                            `Событие сопоставлено с отраслью и ролью «${roles[session.role]}».`,
                            item.bank
                              ? "Сопоставлены учебная новость, профиль и демо-аналитика."
                              : "Материал банка отсутствует: вывод помечен ограничением.",
                            companies[session.company].missing,
                          ][i]
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
            <Separator className="my-6" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm font-medium">Полезный разбор?</span>
              <Button
                size="sm"
                variant={
                  session.feedback[key] === "useful" ? "secondary" : "outline"
                }
                aria-pressed={session.feedback[key] === "useful"}
                onClick={() => feedback("useful")}
              >
                <ThumbsUp />
                Да
              </Button>
              <Button
                size="sm"
                variant={
                  session.feedback[key] === "not-useful"
                    ? "secondary"
                    : "outline"
                }
                aria-pressed={session.feedback[key] === "not-useful"}
                onClick={() => feedback("not-useful")}
              >
                <ThumbsDown />
                Нет
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSession((s) => ({
                    ...s,
                    saved: s.saved.includes(key)
                      ? s.saved.filter((k) => k !== key)
                      : [...s.saved, key],
                  }))
                }
              >
                <Bookmark
                  className={session.saved.includes(key) ? "fill-current" : ""}
                />
                {session.saved.includes(key) ? "Сохранено" : "Сохранить"}
              </Button>
            </div>
            {session.feedback[key] && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                Обратная связь сохранена в этом браузере.
              </p>
            )}
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Сообщить об ошибке
              </summary>
              <div className="mt-3 space-y-2">
                <Label htmlFor="issue">Что нужно исправить?</Label>
                <Textarea
                  id="issue"
                  maxLength={1000}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!issue.trim()}
                  onClick={() => {
                    feedback(`Ошибка: ${issue.trim()}`);
                    setIssue("");
                  }}
                >
                  Сохранить замечание
                </Button>
              </div>
            </details>
          </div>
          <aside className="min-w-0">
            <div className="sticky top-6 rounded-2xl border bg-muted/30 p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-5 text-insight" />
                Уточнить у аналитика
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Демо-ответы по текущей компании и событию. Это не подключённый
                ИИ.
              </p>
              <div className="my-5 flex flex-wrap gap-2">
                {[
                  "Почему это важно?",
                  "Какие риски?",
                  "Что сделать?",
                  "На чём основан вывод?",
                ].map((q) => (
                  <Button
                    key={q}
                    size="sm"
                    variant="outline"
                    className="h-auto whitespace-normal py-2 text-xs"
                    disabled={busy || messages.length >= 40}
                    onClick={() => void ask(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
              <div
                role="log"
                aria-live="polite"
                aria-label="Диалог с аналитиком"
                className="max-h-96 space-y-3 overflow-y-auto"
              >
                {!messages.length && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Спросите о влиянии события на ваш бизнес.
                  </p>
                )}
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-sm leading-6 ${message.author === "user" ? "ml-5 bg-secondary" : "mr-3 border bg-card"}`}
                  >
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {message.author === "user" ? "Вы" : "Демо-аналитик"}
                    </p>
                    {message.text}
                  </div>
                ))}
                {busy && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Готовим демо-ответ…
                  </p>
                )}
              </div>
              <form
                className="mt-4 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(question);
                }}
              >
                <Label htmlFor="question" className="sr-only">
                  Ваш вопрос
                </Label>
                <Textarea
                  id="question"
                  value={question}
                  maxLength={1000}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Как это повлияет на компанию?"
                  disabled={busy || messages.length >= 40}
                />
                <Button
                  className="w-full"
                  disabled={!question.trim() || busy || messages.length >= 40}
                >
                  <Send />
                  Отправить вопрос
                </Button>
              </form>
              {messages.length >= 40 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Лимит демо-диалога достигнут.
                </p>
              )}
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}
