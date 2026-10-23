# Подключение ML-части к бэкенду и фронту

Что добавлено в `research/agent` и что нужно реализовать в `projects/backend` и `projects/frontend`, чтобы это заработало на сайте.

## Что добавлено в ML-часть

| Возможность | Артефакт (экспорт `@alfa/research-agent`) | Файл |
| --- | --- | --- |
| Разбор ответа агента в JSON карточки без второго вызова модели | `createFeedFinalizer`, `parseFeedAnswer`, `toStructuredDraft` | `src/agent/feed-parser.ts` |
| Поля карточки из ответа агента: тип, главное, риски, возможности, шаги, ответ на вопрос | `ParsedEvent`: `kind`, `summary`, `risks`, `opportunities`, `actions`, `answer`, `clarification` | там же |
| Задание агенту с явным режимом: лента или вопрос по карточке | `buildTaskPrompt({ mode, question, asOf, events, context, conversation })`, `TaskEvent` | `src/agent/prompts.ts` |
| Ответы на вопросы: форма и длина по вопросу, без повтора, данные от пользователя, одно уточнение за диалог | разделы промпта `<question_mode>`; `clarificationAllowed(conversation)` | там же |
| ML-отбор событий по размеченным новостям | `rankNewsForCompany`, `ML_RANKING_VERSION`, `loadNewsTags`, `dataPaths().newsTags` | `src/news/ranking.ts`, `src/news/tagging.ts` |
| Разметка новостей моделью | `pnpm news:tag` (~4,4 ₽ на 1019 новостей) | `src/cli/news-tag.ts` |
| Отрасли группы без повторов | `companyGroup(...).memberIndustries` | `src/tools/functions.ts` |

`PROMPT_VERSION` = `stage1-2026-10-23.6`. 41 тест без API. Формула отбора и команды — в `README.md`.

### Формат ответа агента

Лента — блок на каждое выбранное событие:

```
Событие <id>
Тип: риск | возможность | наблюдение
Главное: <смысл для компании>. Признаки: <id>. Оговорка: <...>.
Факт: «<дословная цитата>» [<id новости>]
Позиция банка: «<дословная цитата>» [<id материала>, <дата>]
Вывод / Риск / Возможность / Стоит проверить: <...>. Признаки: <id>. Оговорка: <...>.

Событие <id>: пропустить — <причина>
```

Вопрос — один блок:

```
Событие <id>
Ответ: <ответ на вопрос; может быть многострочным списком>. Признаки: <id>. Оговорка: <...>.
Уточнение: <вопрос пользователю, если не хватает сведений о компании>
Факт: «<дословная цитата>» [<id новости>]
```

`createFeedFinalizer` переводит это в JSON формата `batchDraftSchema` с дополнительными полями события. Для вопроса `answer` уже содержит текст ответа и, если есть, уточняющий вопрос через пустую строку. Если агент ответил на вопрос простым текстом без блока (приветствие), этот текст становится `answer`. Запасной вызов модели (`fallback`) выполняется, только если в ответе ленты нет ни одного блока.

## Что реализовать на бэкенде

Файл: `projects/backend/src/modules/analytics/infrastructure/agent-runtime.ts`.

### 1. Схема ответа

Добавить в событие `batchDraftSchema` необязательные поля (старые сохраненные ответы остаются валидными):

```ts
const noteSchema = z.object({ text: z.string().max(2000), companyFeatureIds: z.array(z.string()), uncertainty: z.string().nullable() })

kind: z.enum(['risk', 'opportunity', 'context']).optional(),
summary: z.string().max(2000).nullable().optional(),
answer: z.string().max(4000).nullable().optional(),
risks: z.array(noteSchema).max(5).optional(),
opportunities: z.array(noteSchema).max(5).optional(),
actions: z.array(noteSchema).max(5).optional(),
```

### 2. Отбор событий

Загрузить разметку один раз на процесс и закэшировать:

```ts
const newsTagsCache = new Map<string, Promise<NewsTags>>()
const newsTagsFor = (dataDir: string) => {
  if (!newsTagsCache.has(dataDir)) newsTagsCache.set(dataDir, loadNewsTags(dataPaths({ DATA_DIR: dataDir }).newsTags))
  return newsTagsCache.get(dataDir)!
}
```

В `execute` вместо `rankNews(...)`:

```ts
const newsTags = this.config.DATA_DIR ? await newsTagsFor(this.config.DATA_DIR) : new Map()
let ranked: RankedNews[] = newsTags.size
  ? rankNewsForCompany(this.ctx, newsTags, run.companyId, {
      perspective: run.perspective,
      asOf: run.createdAt,
      limit: this.config.RANKING_LIMIT,
      since: run.input.timeRange?.since,
      until: run.input.timeRange?.until,
    })
  : rankNews(/* прежние аргументы */)
```

В `executionScope`: `ranking: newsTags.size ? ML_RANKING_VERSION : RANKING_VERSION`. Если файла разметки нет, работают прежние правила.

### 3. Задание агенту

Передавать вопрос, карточку и историю отдельными полями, а не одной строкой: иначе агент отвечает на все вопросы одинаково, пересказом карточки.

```ts
const isQuestion = run.input.kind === 'question'
const question = run.input.question ?? `Разбери события для компании в ракурсе ${run.perspective}. Изучи их через инструменты; позицию банка проверь отдельно.`
let insightContext: unknown = null
let conversation: { author: string; text: string }[] = []
if (isQuestion && run.input.insightId) {
  // insight, news, messages — как сейчас
  insightContext = {
    eventId: insight.event.id, title: insight.event.title, version: insight.version, summary: insight.summary,
    claims: insight.claims.map((c) => ({ kind: c.kind, text: c.text, uncertainty: c.uncertainty })),
    risks: insight.risks, actions: insight.actions, bankPosition: insight.bankPosition.status,
    evidence: insight.evidence.map((e) => ({ documentId: e.documentId, quote: e.quote, publishedAt: e.publishedAt })),
  }
  conversation = messages
    .filter((m) => m.at <= run.createdAt && m.runId !== run.id) // без текущего вопроса и более поздних сообщений
    .slice(-10)
    .map((m) => ({ author: m.author, text: m.text }))
}
```

Добавить `insightContext` и `conversation` в `executionScope`. Первое сообщение графа:

```ts
buildTaskPrompt({
  mode: isQuestion ? 'question' : 'feed',
  question,
  asOf: run.createdAt.slice(0, 10),
  events: ranked.map((r) => ({ id: r.news.id, title: r.news.title, publishedAt: r.news.publishedAt, reasons: r.relevance.reasons })),
  context: insightContext,
  conversation,
})
```

### 4. `finalize`

Текущий код `finalize` вынести в функцию `modelFinalize(state, config)` без изменений и передать запасным путем:

```ts
finalize: async (state, config) => {
  await progress('step.started', { phase: 'verifying_evidence' })
  return createFeedFinalizer({
    ctx: this.ctx,
    eventIds: ranked.map((r) => r.news.id),
    featureIds,
    mode: isQuestion ? 'question' : 'feed',
    allowClarification: clarificationAllowed(conversation),
    fallback: modelFinalize,
  })(state, config)
},
```

### 5. Публикация

`publishDraft` принимает событие целиком (`z.infer<typeof batchDraftSchema>['events'][number]`). После `gateDraft`:

```ts
const noteLine = (n) => (n.uncertainty ? `${n.text} (${n.uncertainty})` : n.text)
i.kind = draft.kind ?? 'context'
if (draft.summary) i.summary = draft.summary
i.risks = (draft.risks ?? []).map(noteLine)
i.opportunities = (draft.opportunities ?? []).map(noteLine)
i.actions = (draft.actions ?? []).map(noteLine)
```

Ответ на вопрос:

```ts
answer: drafts.find((d) => d.answer)?.answer || insights.map((i) => i.summary).join('\n\n') || 'Подтверждённых данных для ответа недостаточно.'
```

Для вопроса `drafts` может содержать событие только с `answer` и без фактов (приветствие, уточнение) — его не нужно публиковать как карточку, нужен только `answer`.

### 6. Профиль компании

Файл: `projects/backend/src/modules/companies/infrastructure/research-catalog.ts`.

- Добавить признак `guarantees` («Гарантии») рядом с `leasing`: агент и отбор используют гарантии, а `gateDraft` отбрасывает выводы с признаком, которого нет в профиле.
- `group_industries`: вместо склейки `members.okvedName` (повторы, только первые 20 компаний) — `companyGroup(...).memberIndustries`, первые 5 с числом компаний и «ещё N».

## Что реализовать на фронте

- `projects/frontend/src/blocks/news-feed/news-feed.tsx`: «Почему для вас» — подписи вместо ID (`industry` → «Отрасль компании», `group_industries` → «Отрасли группы», `supplier_industries` → «Поставщики», `customer_industries` → «Покупатели», `loans` → «Кредиты», `leasing` → «Лизинг», `guarantees` → «Гарантии», `factoring` → «Факторинг», `deposits` → «Депозиты», `customs` → «Внешняя торговля», `payroll` → «Зарплатный проект», `region` → «Регион»).
- `projects/frontend/src/blocks/insight-reader/insight-reader.tsx`:
  - «Ход анализа»: для `tool.completed` выводить название шага по `payload.tool` (`company_profile` → «Профиль компании», `company_group` → «Группа компаний», `company_counterparties` → «Поставщики и покупатели», `news_search` → «Поиск новостей», `bank_search` → «Поиск по аналитике банка», `document_read` → «Чтение документа», `evidence_verify` → «Проверка цитат»);
  - «Почему это важно»: список `reasons` показывать, только если нет `explanations`, и через `featureLabels`.

## Данные и окружение

```sh
git pull && pnpm install
pnpm --filter @alfa/research-agent build          # бэкенд берет агента из dist
unzip bank-ocr.zip                                # распознанные PDF банка (Qwen3.6, сверено вручную), архив передается отдельно
pnpm --filter @alfa/research-agent ingest --bank
pnpm --filter @alfa/research-agent news:tag       # после каждого ingest --news; размечаются только новые новости
```

- В `.env` бэкенда не задавать `LLM_MAX_OUTPUT_TOKENS=2000` (значение по умолчанию 4000; при 2000 JSON обрезался).
- Перезапускать API и worker после сборки пакета, `ingest` и `news:tag`: данные и промпт читаются при старте. Запуски, шедшие во время обновления, завершатся с `execution_context_changed` — их нужно запустить заново.

## Бюджет

Сводка из 3 событий стоит 0,6–1 ₽, вопрос — 0,3–0,6 ₽. При `RUN_RESERVATION_RUB=25` дневной лимит 500 ₽ исчерпывается резервами за 20 запусков, хотя реальные траты около 15 ₽, и дальше бэкенд отвечает «Дневной бюджет исчерпан». Для частых проверок нужен резерв около 8 ₽ с `LLM_GATEWAY_REQUEST_CAP_RUB=1` (резерв покрывает `(AGENT_MAX_STEPS + 2) × cap`); значение для демо — после подтверждения лимита запроса у шлюза.

## Как проверить

1. Компания U_68157, роль «Финансовый директор», «Обновить сводку».
2. Лента: метка «Риск», текст — одна-две фразы о смысле для компании, «Почему для вас» по-русски.
3. Разбор: заполнены «Риски» и «Возможные следующие шаги», одна-две цитаты в «Что произошло».
4. «Ход анализа»: названия шагов.
5. «Вопросы»:
   - «Какие риски?», «Что сделать?», «расскажи кратко», «расскажи в 3 предложениях», «назови 3 риска списком» — разные ответы нужной формы;
   - «насколько вырастут наши расходы по кредитам?» — ответ без выдуманных сумм и уточняющий вопрос; ответ пользователя с цифрами («кредиты 3 млрд, ставка ключевая + 3%») — расчет «по вашим данным» без нового уточнения;
   - «привет!» — короткий ответ с подсказкой, о чем спросить.
6. В `agent_model_calls` у запуска нет ключа `structure` — второй вызов модели не выполнялся.

## уточнение

1. 25р на запрос - слишком много. ни один запрос еще не тратил больше 5р - можно поставить 5-8р для каких-то больших вопросов.

## Статус интеграции backend

Пункты 1–8 подключены: отдельные `summary`, `kind`, `risks`, `opportunities`, `actions`, `answer`; проверка утверждений по одному; исключение пропущенных событий и цитат, отсутствующих в ответе агента; топ-5 отраслей группы с количеством участников; признак `guarantees` на сервере и в промпте. Исправлена граница кириллического слова «газ» в отборе новостей.

По умолчанию отбирается до 10 событий (настраивается `RANKING_LIMIT`, максимум 20); агент и проверка доказательств могут сократить публикацию. Используется структурирующий `finalize`; `parseFeedAnswer` уже реализован в research; подключение оптимизации к backend остаётся отдельным шагом. Контракт API и SQL-схема не изменились.

Для локального запуска импортирован проверенный Qwen3.6 OCR: 9 документов, 64 страницы, 212 поисковых фрагментов. OCR и подготовленный корпус находятся в игнорируемом `data/processed`, не в Git. После получения архива в другой среде нужно повторить `ingest --bank`.

Резерв production-бюджета не снижен без подтверждения лимита шлюза. Явное локальное `ALLOW_UNCAPPED_LLM=true` разрешено только при `NODE_ENV=development` и отключает резервирование; по умолчанию флаг выключен.
