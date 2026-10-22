import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  companies,
  initialSession,
  news,
  rankedNews,
  roles,
  runAnalysis,
  scopeKey,
  steps,
  type CompanyId,
  type Kind,
  type News,
  type Role,
  type RunRecord,
  type Scenario,
  type View,
} from "./model";
import { useDemoSession } from "./session";
import { InsightDetail } from "./insight-detail";

const nav = [
  { id: "feed", label: "Для вас", icon: LayoutDashboard },
  { id: "saved", label: "Сохранённое", icon: Bookmark },
  { id: "company", label: "Контекст компании", icon: Building2 },
  { id: "history", label: "История анализа", icon: History },
] as const;
const kindLabels = {
  risk: "Риск",
  opportunity: "Возможность",
  watch: "Наблюдение",
} as const;
const statuses = {
  complete: "Готово",
  partial: "Частичный результат",
  empty: "Нет событий",
  failed: "Ошибка",
  cancelled: "Отменён",
} as const;
const scenarioLabels: Record<Scenario, string> = {
  normal: "Обычный анализ",
  partial: "Недоступен источник",
  empty: "Нет подходящих событий",
  error: "Ошибка сервиса",
  budget: "Лимит анализа",
  denied: "Нет доступа",
};
function Brand() {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-xl bg-brand text-2xl font-black text-white"
      >
        А
      </span>
      <span className="text-lg font-bold tracking-tight">
        Альфа<span className="font-normal"> Бизнес</span>
      </span>
    </span>
  );
}

export function DemoApp() {
  const { session, setSession, ready, storageWarning } = useDemoSession(),
    { setTheme, resolvedTheme } = useTheme();
  const [view, setView] = useState<View>("feed"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<Kind | "all">("all"),
    [selected, setSelected] = useState<News | null>(null);
  const [setup, setSetup] = useState(false),
    [pickCompany, setPickCompany] = useState<CompanyId>("nord"),
    [pickRole, setPickRole] = useState<Role>("cfo");
  const [running, setRunning] = useState(false),
    [step, setStep] = useState(0),
    [scenario, setScenario] = useState<Scenario>("normal"),
    [result, setResult] = useState("complete"),
    [error, setError] = useState("");
  const [demoSettings, setDemoSettings] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const company = companies[session.company],
    items = rankedNews(session.company, session.role);
  const scopedSaved = session.saved.filter((k) =>
    k.startsWith(`${session.company}:${session.role}:`),
  );
  const filtered = items.filter(
    (item) =>
      (filter === "all" || item.kind === filter) &&
      `${item.title} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (view !== "saved" ||
        session.saved.includes(
          scopeKey(session.company, session.role, item.id),
        )),
  );
  const history = session.history.filter(
    (run) => run.company === session.company && run.role === session.role,
  );
  function changeContext() {
    setPickCompany(session.company);
    setPickRole(session.role);
    setSetup(true);
  }
  function enter() {
    setSession((s) => ({
      ...s,
      entered: true,
      company: pickCompany,
      role: pickRole,
    }));
    setSetup(false);
    setView("feed");
    setSearch("");
    setFilter("all");
    setSelected(null);
    setError("");
    setResult("complete");
  }
  function toggleSaved(item: News) {
    const key = scopeKey(session.company, session.role, item.id);
    setSession((s) => ({
      ...s,
      saved: s.saved.includes(key)
        ? s.saved.filter((k) => k !== key)
        : [...s.saved, key],
    }));
  }
  async function analyze(mode: Scenario = scenario) {
    if (running) return;
    const ac = new AbortController();
    controller.current = ac;
    setRunning(true);
    setError("");
    setView("feed");
    setSelected(null);
    const record = {
      id: crypto.randomUUID(),
      company: session.company,
      role: session.role,
      at: new Date().toISOString(),
    };
    let status: RunRecord["status"] = "failed";
    try {
      const value = await runAnalysis(mode, ac.signal, setStep);
      setResult(value);
      status = value;
      toast.success(
        value === "partial"
          ? "Демо-анализ завершён с ограничением"
          : "Демо-анализ завершён",
      );
    } catch (e) {
      if (ac.signal.aborted) {
        status = "cancelled";
        toast("Анализ отменён");
      } else {
        setError(e instanceof Error ? e.message : "error");
        setResult("complete");
      }
    } finally {
      setRunning(false);
      setSession((s) => ({
        ...s,
        history: [{ ...record, status }, ...s.history].slice(0, 50),
      }));
    }
  }
  function exportDigest() {
    const text = [
      "ДЕМО · Синтетическая сводка · 21.10.2026",
      company.name,
      roles[session.role],
      "Не является реальной аналитикой банка.",
      ...filtered.map(
        (n) =>
          `\n${n.title}\n${n.context[session.company].impact}\nИсточник: ${n.source}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `alfa-demo-${session.company}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Демо-сводка скачана");
  }
  const setupDialog = (
    <Dialog open={setup} onOpenChange={setSetup}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Настроим аналитику под вас</DialogTitle>
          <DialogDescription>
            Выберите учебную компанию и роль. Это меняет приоритеты ленты и
            объяснения событий.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-3">
          <div className="space-y-2">
            <Label htmlFor="company-select">Компания</Label>
            <NativeSelect
              id="company-select"
              className="w-full"
              value={pickCompany}
              onChange={(e) => setPickCompany(e.target.value as CompanyId)}
            >
              {Object.entries(companies).map(([id, c]) => (
                <NativeSelectOption key={id} value={id}>
                  {c.name} · {c.industry}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-select">Ваша роль</Label>
            <NativeSelect
              id="role-select"
              className="w-full"
              value={pickRole}
              onChange={(e) => setPickRole(e.target.value as Role)}
            >
              {Object.entries(roles).map(([id, label]) => (
                <NativeSelectOption key={id} value={id}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="rounded-xl bg-muted p-4 text-sm leading-6">
            {companies[pickCompany].description}
            <p className="mt-2 text-muted-foreground">
              Выручка {companies[pickCompany].revenue} · Синтетический профиль
            </p>
          </div>
          <Button className="w-full" onClick={enter}>
            Перейти к аналитике <ArrowRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  if (!ready)
    return (
      <main
        aria-label="Загрузка приложения"
        className="mx-auto max-w-5xl space-y-6 p-10"
      >
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-72 w-full" />
      </main>
    );
  if (!session.entered)
    return (
      <div className="min-h-svh bg-muted/40">
        <header className="border-b bg-background">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-5">
            <Brand />
            <Badge variant="outline">Демо-банк</Badge>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-12 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <section>
              <Badge variant="insight" className="mb-6">
                <Sparkles /> Новостная аналитика
              </Badge>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
                Мир меняется.
                <br />
                <span className="text-brand">Вы видите главное.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                События рынка, которые важны именно вашей компании. С
                объяснением влияния, рисками и возможными действиями.
              </p>
              <Button
                size="lg"
                className="mt-8 h-12 px-7"
                onClick={changeContext}
              >
                Открыть аналитику <ArrowUpRight />
              </Button>
              <p className="mt-4 max-w-md text-xs leading-5 text-muted-foreground">
                Интерактивное демо. Компании, новости и ответы вымышлены.
                Банковский вход и внешние сервисы не используются.
              </p>
            </section>
            <Card className="overflow-hidden border-0 bg-insight text-white shadow-xl">
              <CardHeader className="p-7">
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Ваш бизнес в контексте
                  </span>
                  <Sparkles className="size-6" />
                </div>
                <CardTitle className="text-3xl leading-tight">
                  Не просто новости.
                  <br />
                  Основания для решений.
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-7 pb-7">
                {[
                  ["01", "Контекст", "Отрасль, компания и ваша роль"],
                  ["02", "Влияние", "Риски и возможности для бизнеса"],
                  ["03", "Прозрачность", "Источники и границы выводов"],
                ].map(([n, title, text]) => (
                  <div
                    key={n}
                    className="flex gap-4 rounded-xl bg-white/10 p-4"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success text-sm font-bold text-black">
                      {n}
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-white/80">{text}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="mt-16 grid gap-5 border-t pt-8 sm:grid-cols-3">
            {[
              ["2 компании", "Разные отрасли и контекст"],
              ["2 роли", "Приоритеты CFO и директора"],
              ["Полный цикл", "От новости до следующего шага"],
            ].map(([title, text]) => (
              <div key={title}>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </main>
        {setupDialog}
      </div>
    );
  return (
    <div className="min-h-svh bg-muted/35">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3"
      >
        К содержимому
      </a>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex min-h-20 items-center justify-between gap-3 px-5 lg:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              Демо · 21 октября
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Переключить тему"
                  onClick={() =>
                    setTheme(resolvedTheme === "dark" ? "light" : "dark")
                  }
                >
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Переключить тему</TooltipContent>
            </Tooltip>
            <Avatar className="size-9">
              <AvatarFallback className="bg-insight text-white">
                ДМ
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[250px_1fr]">
        <aside className="border-b bg-background p-4 lg:sticky lg:top-20 lg:flex lg:h-[calc(100svh-5rem)] lg:flex-col lg:border-b-0 lg:border-r lg:p-5">
          <Button
            variant="outline"
            className="mb-5 h-auto w-full justify-start gap-3 whitespace-normal py-3 text-left"
            disabled={running}
            onClick={changeContext}
          >
            <Building2 className="size-5 shrink-0" />
            <span>
              <span className="block font-semibold">{company.name}</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {roles[session.role]}
              </span>
            </span>
          </Button>
          <nav
            aria-label="Разделы аналитики"
            className="flex gap-1 overflow-x-auto lg:flex-col"
          >
            {nav.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={view === id ? "secondary" : "ghost"}
                className={`justify-start ${view === id ? "font-semibold" : ""}`}
                aria-current={view === id ? "page" : undefined}
                onClick={() => {
                  setView(id);
                  setSearch("");
                  setFilter("all");
                }}
              >
                <Icon />
                {label}
                {id === "saved" && scopedSaved.length > 0 && (
                  <Badge variant="outline" className="ml-auto">
                    {scopedSaved.length}
                  </Badge>
                )}
              </Button>
            ))}
          </nav>
          <div className="mt-5 hidden space-y-3 lg:mt-auto lg:block">
            <div className="rounded-xl bg-insight p-4 text-white">
              <Sparkles className="mb-3 size-5" />
              <p className="text-sm font-semibold">Контекст имеет значение</p>
              <p className="mt-2 text-xs leading-5 text-white/80">
                Попробуйте другую компанию или роль — порядок событий изменится.
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setDemoSettings(true)}
            >
              <Settings2 />
              Сценарии демо
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              disabled={running}
              onClick={() => {
                setSession((s) => ({ ...s, entered: false }));
                setSelected(null);
              }}
            >
              <LogOut />
              Выйти из демо
            </Button>
            <Button asChild variant="link" size="sm">
              <Link to="/ui-kit">Открыть UI-kit</Link>
            </Button>
          </div>
        </aside>
        <main id="main" className="min-w-0 p-5 sm:p-8 lg:p-10">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Бизнес-инсайты / {company.industry}
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {view === "feed"
                  ? "Важное для вашего бизнеса"
                  : view === "saved"
                    ? "Сохранённые инсайты"
                    : view === "company"
                      ? "Контекст компании"
                      : "История анализа"}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {view === "feed"
                  ? `Персональная сводка · ${roles[session.role]} · 21 октября 2026`
                  : company.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Сценарии демо"
                onClick={() => setDemoSettings(true)}
              >
                <Settings2 />
              </Button>
              <Button disabled={running} onClick={() => void analyze()}>
                {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Обновить анализ
              </Button>
            </div>
          </div>
          <div className="mb-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Демо-режим: синтетические данные и сценарные ответы. Не реальная
              аналитика Альфа-Банка.{" "}
              {storageWarning
                ? "Хранилище недоступно или повреждено: изменения могут не сохраниться."
                : "Избранное, диалоги и оценки сохраняются только в этом браузере."}
            </p>
          </div>
          {running && (
            <Card className="mb-6 border-insight/40">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <Loader2 className="size-4 animate-spin text-insight" />
                    {steps[step]}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => controller.current?.abort()}
                  >
                    Отменить
                  </Button>
                </div>
                <Progress value={(step + 1) * 25} />
                <p className="text-xs text-muted-foreground">
                  Симуляция анализа · шаг {step + 1} из 4
                </p>
              </CardContent>
            </Card>
          )}
          {view === "company" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{company.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-6 text-muted-foreground">
                    {company.description}
                  </p>
                  <div className="grid gap-5 sm:grid-cols-3">
                    {[
                      ["Выручка", company.revenue],
                      ["Сотрудники", company.employees],
                      ["Регион", company.region],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-2 text-lg font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Что влияет на вашу ленту</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {company.features.map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm"
                    >
                      <Check className="size-4 text-insight" />
                      {f}
                    </div>
                  ))}
                  <p className="col-span-full mt-3 text-xs text-muted-foreground">
                    Источник всех признаков: синтетический профиль, версия 1.
                    Доля рынка неизвестна и не используется.
                  </p>
                </CardContent>
              </Card>
              <Alert>
                <CircleHelp />
                <AlertTitle>Неполные данные</AlertTitle>
                <AlertDescription>{company.missing}</AlertDescription>
              </Alert>
            </div>
          ) : view === "history" ? (
            <Card>
              <CardHeader>
                <CardTitle>Запуски для текущей компании и роли</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length ? (
                  history.map((run) => (
                    <div
                      key={run.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">Анализ событий</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(run.at).toLocaleString("ru-RU", {
                            timeZone: "Europe/Moscow",
                          })}{" "}
                          · МСК
                        </p>
                      </div>
                      <Badge
                        variant={
                          run.status === "complete"
                            ? "success"
                            : run.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {statuses[run.status]}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Здесь появятся ваши запуски"
                    text="Обновите анализ, чтобы увидеть его результат в истории."
                    action="Запустить анализ"
                    onAction={() => void analyze()}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {view === "feed" && (
                <div className="mb-7 grid gap-4 sm:grid-cols-3">
                  {[
                    ["Событий в фокусе", items.length.toString(), FileText],
                    [
                      "Возможности",
                      items
                        .filter((n) => n.kind === "opportunity")
                        .length.toString(),
                      TrendingUp,
                    ],
                    [
                      "Требуют внимания",
                      items.filter((n) => n.kind === "risk").length.toString(),
                      Bell,
                    ],
                  ].map(([label, value, Icon]) => {
                    const I = Icon as typeof FileText;
                    return (
                      <Card key={label as string} className="gap-0 py-5">
                        <CardContent className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {label as string}
                            </p>
                            <p className="mt-2 text-3xl font-semibold">
                              {result === "empty" ? "0" : (value as string)}
                            </p>
                          </div>
                          <span className="rounded-xl bg-muted/60 p-3">
                            <I className="size-5" />
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(["all", "risk", "opportunity", "watch"] as const).map(
                    (k) => (
                      <Button
                        key={k}
                        size="sm"
                        variant={filter === k ? "default" : "outline"}
                        aria-pressed={filter === k}
                        onClick={() => setFilter(k)}
                      >
                        {k === "all" ? "Все события" : kindLabels[k]}
                      </Button>
                    ),
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      aria-label="Поиск по новостям"
                      className="pl-9"
                      placeholder="Поиск по событиям"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Скачать сводку"
                    onClick={exportDigest}
                    disabled={
                      running ||
                      !!error ||
                      result === "empty" ||
                      !filtered.length
                    }
                  >
                    <ArrowDownToLine />
                  </Button>
                </div>
              </div>
              {error && view === "feed" ? (
                <Alert variant="destructive">
                  <CircleHelp />
                  <AlertTitle>
                    {error === "budget"
                      ? "Лимит анализа исчерпан"
                      : error === "denied"
                        ? "Нет доступа к источникам"
                        : "Не удалось завершить анализ"}
                  </AlertTitle>
                  <AlertDescription>
                    <p>
                      {error === "budget"
                        ? "Сценарий ограничения бюджета. Реальные средства не расходуются."
                        : error === "denied"
                          ? "Сценарий отказа в доступе. Источники не раскрываются."
                          : "Демонстрационная ошибка сервиса. Можно повторить запуск."}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      disabled={running}
                      onClick={() => {
                        setScenario("normal");
                        void analyze("normal");
                      }}
                    >
                      Повторить обычный анализ
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : result === "empty" && view === "feed" ? (
                <Empty
                  title="Подходящих событий пока нет"
                  text="В этом демо-сценарии источники не вернули новых событий."
                  action="Вернуться к обычному сценарию"
                  onAction={() => {
                    setScenario("normal");
                    void analyze("normal");
                  }}
                />
              ) : (
                <>
                  {result === "partial" && view === "feed" && (
                    <Alert className="mb-5">
                      <CircleHelp />
                      <AlertTitle>Один источник недоступен</AlertTitle>
                      <AlertDescription>
                        Показаны результаты по доступным учебным материалам.
                        Полнота выводов ограничена; позиция банка не
                        обновлялась.
                      </AlertDescription>
                    </Alert>
                  )}
                  {filtered.length ? (
                    <div className="space-y-4">
                      {filtered.map((item, index) => (
                        <Card
                          key={item.id}
                          className={`group gap-0 overflow-hidden py-0 ${index === 0 && view === "feed" ? "border-insight/35" : ""}`}
                        >
                          <CardContent className="p-5 sm:p-6">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  item.kind === "opportunity"
                                    ? "success"
                                    : item.kind === "risk"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {kindLabels[item.kind]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {item.category} · {item.time}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto"
                                aria-label={`${session.saved.includes(scopeKey(session.company, session.role, item.id)) ? "Убрать из избранного" : "Сохранить"}: ${item.title}`}
                                aria-pressed={session.saved.includes(
                                  scopeKey(
                                    session.company,
                                    session.role,
                                    item.id,
                                  ),
                                )}
                                onClick={() => toggleSaved(item)}
                              >
                                <Bookmark
                                  className={
                                    session.saved.includes(
                                      scopeKey(
                                        session.company,
                                        session.role,
                                        item.id,
                                      ),
                                    )
                                      ? "fill-current text-insight"
                                      : ""
                                  }
                                />
                              </Button>
                            </div>
                            <h2 className="mb-3 text-xl font-semibold leading-snug">
                              <Button
                                variant="link"
                                className="h-auto justify-start whitespace-normal p-0 text-left text-xl leading-snug text-foreground"
                                onClick={() => setSelected(item)}
                              >
                                {item.title}
                              </Button>
                            </h2>
                            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                              {item.context[session.company].impact}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                              <p className="flex max-w-2xl items-start gap-2 text-xs leading-5 text-muted-foreground">
                                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-insight" />
                                {item.context[session.company].reason}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelected(item)}
                              >
                                Разобрать влияние <ArrowRight />
                              </Button>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Приоритет {item.score}/100 · Оценка релевантности,
                              не достоверности
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title={
                        view === "saved" && !search && filter === "all"
                          ? "Пока ничего не сохранено"
                          : "Ничего не найдено"
                      }
                      text={
                        view === "saved"
                          ? "Сохраните интересное событие из ленты или измените фильтры."
                          : "Попробуйте другой запрос или уберите фильтры."
                      }
                      action="Показать все события"
                      onAction={() => {
                        setView("feed");
                        setSearch("");
                        setFilter("all");
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
            <span>Альфа Бизнес · Новостная аналитика · Демо</span>
            <Button
              variant="link"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setDemoSettings(true)}
            >
              Как проверить демо
            </Button>
          </footer>
        </main>
      </div>
      {setupDialog}
      <Dialog open={demoSettings} onOpenChange={setDemoSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сценарии демонстрации</DialogTitle>
            <DialogDescription>
              Выберите состояние следующего запуска. Все задержки, ошибки и
              ответы моделируются в браузере.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="scenario">Следующий анализ</Label>
            <NativeSelect
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
            >
              {Object.entries(scenarioLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              className="w-full"
              disabled={running}
              onClick={() => {
                setDemoSettings(false);
                void analyze();
              }}
            >
              Запустить сценарий
            </Button>
            <Separator />
            <p className="text-sm leading-6 text-muted-foreground">
              Пройдите путь: компания и роль → событие → разбор → источники →
              вопрос → оценка. Смените компанию, чтобы сравнить персонализацию.
              Сохраните событие и обновите страницу — оно останется в избранном.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={running}
              onClick={() => {
                setDemoSettings(false);
                changeContext();
              }}
            >
              Сменить компанию или роль
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              disabled={running}
              onClick={() => {
                setSession(initialSession);
                setDemoSettings(false);
                setSelected(null);
                setResult("complete");
                setError("");
                setView("feed");
                toast("Демо сброшено");
              }}
            >
              Сбросить мои демо-данные
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {selected && (
        <InsightDetail
          key={scopeKey(session.company, session.role, selected.id)}
          item={selected}
          session={session}
          setSession={setSession}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <Search className="mx-auto mb-4 size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {text}
      </p>
      <Button variant="outline" className="mt-5" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}
