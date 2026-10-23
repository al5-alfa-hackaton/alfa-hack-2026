# Задание для агента: связать бэкенд с `@alfa/agent`

Этот файл — инструкция для правки в `projects/backend` и `projects/frontend`. Пакет `packages/agent` менять не нужно: всё, что перечислено ниже, в нем уже есть и экспортируется из `@alfa/agent`.

Перед началом: `pnpm --filter @alfa/agent build` (бэкенд берет агента из `dist`). После правок: `pnpm --filter backend test` и `pnpm --filter backend typecheck` проходят.

Основной файл — `projects/backend/src/modules/analytics/infrastructure/agent-runtime.ts`, метод `LangGraphRuntime.execute`.

## Что сейчас не связано

| Часть агента | Что делает | Что сейчас в бэкенде |
| --- | --- | --- |
| `createFeedFinalizer` | разбирает ответ агента кодом в черновик для `parseDraftBatch` | второй вызов модели в `finalize` перекладывает текст в JSON |
| `buildTaskPrompt({ mode, events, context, conversation })` | режимы «лента» и «вопрос» с отдельными полями | все склеено в одну строку `question` |
| `clarificationAllowed` | разрешает одно уточнение за диалог | не используется |
| `rankNewsForCompany` + `loadNewsTags` | ML-отбор по разметке новостей и связям компании | `rankNews` по совпадению слов |
| `FEATURE_IDS`, `FEATURE_LABELS` | единый список признаков компании, на который ссылается агент | список и подписи заданы вручную в двух местах |
| `NewsItem.textSource` | `'article'`, если текст новости — полная статья | источник всегда помечается как лид |
| `news:refresh` | загрузка новостей, полные тексты, разметка | не запускается |

## 1. `finalize`: разбор кодом, модель — запасной путь

**Зачем.** Второй вызов модели ошибается в формате. Пример: факт записывается в кавычках-ёлочках («…»), перестает дословно совпадать с цитатой, `gateDraft` его отбрасывает, и пользователь видит «Недостаточно подтверждённых данных». Кроме того, это лишний платный вызов на каждую сводку и вопрос. `createFeedFinalizer`:
- снимает кавычки;
- сокращает цитаты длиннее 300 символов по границе предложения;
- сверяет цитаты с документом;
- отбрасывает события с пометкой «пропустить»;
- убирает признаки не из списка.

Риски, возможности и шаги он отдает строками «текст (оговорка)», как ждет `listSchema` в `agent-draft.ts`.

**Что сделать.**
1. Текущее тело `finalize` без изменений вынести в функцию `modelFinalize(state, config)`.
2. В `finalize` вызвать:

```ts
import { createFeedFinalizer, clarificationAllowed } from '@alfa/agent'

finalize: async (state, config) => {
  const last = state.messages.at(-1)
  agentAnswer = last ? textOf(last) : ''
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

`fallback` срабатывает, только если в ответе агента нет ни одного блока «Событие …». `isQuestion` и `conversation` описаны в п.2.

**Тесты.**
- В `test/langgraph.test.ts` и `test/integration.test.ts` число вызовов модели на запуск меняется с 2 на 1.
- Фейковая модель должна отвечать текстом в формате ленты (`Событие …` / `Тип:` / `Главное: … Признаки: loans. Оговорка: …` / `Факт: «…» [news_…]` / `Риск: …` / `Стоит проверить: …`), а не JSON.
- Ожидаемые значения:
  - `summary` — без префикса «Главное:»;
  - `risks` — `['Процентные расходы могут вырасти. (тип ставки неизвестен)']`;
  - `actions` — `['Проверить условия кредитования. (договоры не раскрыты)']`.
- Событие с пометкой «пропустить» не попадает в `insights`.

## 2. Задание агенту: режим и отдельные поля

**Зачем.** Сейчас вопрос пользователя склеен в одну строку с карточкой, историей диалога и событиями. Агент воспринимает это как повторный разбор события и отвечает на «Какие риски?», «Что сделать?» и «расскажи кратко» почти одинаково. В режиме вопроса агент:
- отвечает в форме, которую просит пользователь («в N предложениях», «списком», «кратко»);
- учитывает данные, которые пользователь сообщил в диалоге;
- при нехватке данных задает уточняющий вопрос — один раз за диалог.

**Что сделать.** Вместо `question += 'Контекст …'` и склейки событий в строке `question`:

```ts
const isQuestion = run.input.kind === 'question'
const question =
  run.input.question ??
  `Разбери события для компании в ракурсе ${run.perspective}. Подготовь отдельный краткий разбор каждого выбранного события; позицию банка проверь отдельно.`
let insightContext: unknown = null
let conversation: { author: string; text: string }[] = []
if (isQuestion && run.input.insightId) {
  // insight, news, ranked, messages — как сейчас
  insightContext = {
    eventId: insight.event.id,
    title: insight.event.title,
    version: insight.version,
    summary: insight.summary,
    claims: (insight.claims ?? []).map((c) => ({ kind: c.kind, text: c.text, uncertainty: c.uncertainty })),
    risks: insight.risks ?? [],
    actions: insight.actions ?? [],
    bankPosition: insight.bankPosition?.status ?? 'missing',
    evidence: (insight.evidence ?? []).map((e) => ({ documentId: e.documentId, quote: e.quote, publishedAt: e.publishedAt })),
  }
  conversation = messages
    .filter((m) => m.at <= run.createdAt && m.runId !== run.id)
    .slice(-10)
    .map((m) => ({ author: m.author, text: m.text }))
}
```

Первое сообщение графа:

```ts
buildTaskPrompt({
  mode: isQuestion ? 'question' : 'feed',
  question,
  asOf: run.createdAt.slice(0, 10),
  events: ranked.map((r) => ({ id: r.news.id, title: r.news.title, text: r.news.text, publishedAt: r.news.publishedAt, reasons: r.relevance.reasons })),
  context: insightContext,
  conversation,
})
```

Добавить `insightContext` и `conversation` в объект, из которого считается `executionScope`. Иначе возобновленный запуск может получить другой промпт.

## 3. Ответ на вопрос берется из черновика, а не после проверки фактов

**Зачем.** Сейчас ответ собирается только из событий, прошедших `gateDraft`. В ответе на приветствие или в уточняющем вопросе («Какой объем кредитов привязан к ключевой ставке?») фактов нет. Поэтому такой ответ теряется, и пользователь видит «Подтверждённых данных для ответа недостаточно».

**Что сделать.** В возврате `execute` для `kind === 'question'`:

```ts
answer: drafts.find((d) => d.answer)?.answer || answers.join('\n\n') || 'Подтверждённых данных для ответа недостаточно.',
```

Поле `answer` из `createFeedFinalizer` уже содержит ответ и, через пустую строку, уточняющий вопрос, если он есть. Публикация карточек ленты не меняется.

**Тесты.** На «привет!» фейковая модель отвечает обычным текстом без блоков — `result.answer` равен этому тексту. Ответ с `Уточнение: …` и без фактов возвращается целиком, вместе с уточнением.

## 4. ML-отбор событий

**Зачем.** Правила по словам дают всем компаниям одни и те же новости. Например, «Суд в Калининграде взыскал с Raiffeisen €342 млн» попадала в топ-3 стройке, рознице, топливу и перевозкам. Оценка на размеченных наборах (`results/eval-ranking-*.md`, команда `pnpm --filter @alfa/agent eval:ranking`), в среднем по ролям CFO и CEO:

| | P@3 | nDCG@5 | Нерелевантных в топ-3 |
| --- | --- | --- | --- |
| правила, компании настройки | 53% | 0,44 | 47% |
| ML, компании настройки | 69% | 0,63 | 31% |
| правила, отложенные компании | 44% | 0,34 | 56% |
| ML, отложенные компании | 69% | 0,72 | 31% |

Формат результата — `RankedNews`. В `reasons` — до трех ID признаков из `FEATURE_IDS`, по убыванию веса.

**Что сделать.**

```ts
import { dataPaths, loadNewsTags, rankNewsForCompany, ML_RANKING_VERSION, type NewsTags } from '@alfa/agent'

const newsTagsCache = new Map<string, Promise<NewsTags>>()
function newsTagsFor(dataDir: string) {
  let tags = newsTagsCache.get(dataDir)
  if (!tags) newsTagsCache.set(dataDir, (tags = loadNewsTags(dataPaths({ DATA_DIR: dataDir }).newsTags)))
  return tags
}
```

В `execute` вместо `rankNews(...)`; если разметки нет, остаются правила:

```ts
const newsTags: NewsTags = this.config.DATA_DIR ? await newsTagsFor(this.config.DATA_DIR) : new Map()
let ranked: RankedNews[] = newsTags.size
  ? rankNewsForCompany(this.ctx, newsTags, run.companyId, {
      perspective: run.perspective,
      asOf: run.createdAt,
      limit: this.config.RANKING_LIMIT,
      since: run.input.timeRange?.since,
      until: run.input.timeRange?.until,
    })
  : rankNews(this.ctx.news, context.features, run.perspective, run.createdAt, run.input.timeRange, this.config.RANKING_LIMIT)
```

В `executionScope`: `ranking: newsTags.size ? ML_RANKING_VERSION : RANKING_VERSION`.

Разметка лежит в `data/processed/news-tags.json` и в git не хранится. Пока файла нет, работает откат на правила. Создать файл: `pnpm --filter @alfa/agent news:refresh` (п.7), затем перезапустить API и worker.

**Тест.** Создать во временной папке `DATA_DIR` с `processed/news-tags.json` (`promptVersion: NEWS_TAG_PROMPT_VERSION`, теги на новость фикстуры) и проверить, что `executionScope.ranking === ML_RANKING_VERSION`. Без файла остается `RANKING_VERSION`.

**Проверить вручную.** Профиль, созданный при регистрации (`profileSource: 'user'`): отбор должен работать по отрасли, продуктам и ВЭД. Связей с группой и контрагентами у такого профиля нет.

## 5. Единый список признаков

**Зачем.** Агент ссылается на признаки компании по ID (`Признаки: loans, industry`), а `createFeedFinalizer` отбрасывает ID, которых нет в `featureIds`. Сейчас список признаков и подписи заданы вручную в двух местах:
- в бэкенде — `research-catalog.ts`;
- во фронтенде — `entities/company/model.ts`.

Если в одном месте появится признак, которого нет в агенте, ссылки на него будут молча пропадать.

**Что сделать.**
- В `projects/backend/src/modules/companies/infrastructure/research-catalog.ts` ID признаков брать из `FEATURE_IDS`. Добавить тест: каждый `feature.id` из `context()` удовлетворяет `isFeatureId`.
- `featureIds` в `agent-runtime.ts` — пересечение признаков компании с `FEATURE_IDS`.
- Во фронтенде (`projects/frontend/src/entities/company/model.ts`) подписи `label` взять из `FEATURE_LABELS` или сверить с ним. Тексты `reason` оставить как есть.

## 6. Полные тексты новостей

**Зачем.** `news:fulltext` подтягивает текст статьи со страницы источника. Сейчас полный текст есть у 1718 из 2001 новости: у РИА, Ведомостей и событий ЦБ раньше был пустой лид. Агенту есть что цитировать, а читателю карточки — что открыть. При этом источник по-прежнему помечается как «Доступен лид публикации».

**Что сделать.**
- `projects/backend/src/modules/analytics/infrastructure/agent-runtime.ts` (сборка `evidence`) и `.../infrastructure/documents.ts`: для новости `contentExtent: news.textSource === 'article' ? 'full_text' : 'lead'`.
- В `routes.ts` расширить enum ответа документа до `['page', 'lead', 'full_text']` и перегенерировать `packages/api-client`.
- `projects/frontend/src/blocks/insight-reader/sources-panel.tsx`: для `full_text` показывать «Полный текст публикации». Сейчас туда попадает `'Страница ' + page`, а `page` у новости равен `null`.

## 7. Обновление данных по расписанию

**Зачем.** Новости, полные тексты и разметка не хранятся в git и сами не обновляются.

**Что сделать.**
- Раз в сутки (cron или задача BullMQ в worker) запускать `pnpm --filter @alfa/agent news:refresh`. Команда выполняет `ingest --news`, затем `news:fulltext`, затем `news:tag`. Размечаются только новые и измененные новости: около 0,007 ₽ на новость.
- После обновления перечитать корпус в API и worker (или перезапустить их). Запуски, которые шли во время обновления, завершатся с `execution_context_changed` — их нужно запустить заново.
- Материалы банка: `unzip bank-ocr.zip` (архив передается отдельно), затем `pnpm --filter @alfa/agent ingest --bank`.
- В `.env` бэкенда не задавать `LLM_MAX_OUTPUT_TOKENS=2000`: по умолчанию 4000, а при 2000 ответ обрезается.
- `RUN_RESERVATION_RUB=25` исчерпывает дневной лимит 500 ₽ за 20 запусков, хотя сводка стоит 0,6–1 ₽, а вопрос — 0,3–0,6 ₽. Снизить резерв до `(AGENT_MAX_STEPS + 2) × LLM_GATEWAY_REQUEST_CAP_RUB`.

## Как принять работу

1. `client_u_68157`, «Обновить сводку»:
   - в ленте карточки с меткой «Риск»;
   - в «Почему для вас» — не больше трех причин;
   - в `agent_model_calls` у запуска нет ключа `structure`.
2. В разборе события заполнены «Риски» и «Возможные следующие шаги». У новости РИА или Ведомостей источник помечен «Полный текст публикации».
3. «Вопросы»:
   - «Какие риски?», «Что сделать?», «расскажи в 3 предложениях», «назови 3 риска списком» дают разные ответы нужной формы;
   - «насколько вырастут наши расходы по кредитам?» — без выдуманных сумм, с уточняющим вопросом;
   - следующий ответ пользователя «кредиты 3 млрд, ставка ключевая + 3%» дает расчет по его данным без нового уточнения;
   - «привет!» — короткий ответ с подсказкой, о чем спросить.
4. `pnpm --filter @alfa/agent eval:answers` (около 8 ₽) воспроизводит эти проверки на шести компаниях и пишет отчет в `packages/agent/results/`. Ориентир — значения из последнего отчета `eval-answers-*.md`.
5. `pnpm --filter @alfa/agent eval:ranking` (бесплатно) сравнивает ML-отбор с правилами на размеченных наборах `eval/ranking-set.json` и `eval/ranking-holdout.json`. Ориентир: P@3 у ML около 69% на обоих наборах, у правил — 44–53%.
