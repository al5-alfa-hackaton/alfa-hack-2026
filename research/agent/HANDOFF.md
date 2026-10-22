# Изменения в агенте и что нужно на бэкенде

## Что уже сделано в `research/agent` (в `origin/main`)

| Коммит | Что изменилось |
| --- | --- |
| `17f06e6` | Режим ленты в промпте. Если в задаче есть «Выбранные события», агент разбирает каждое событие отдельным блоком, дает дословные цитаты с ID документа и пропускает нерелевантные события строкой «Событие <id>: пропустить — причина». Новое поле `memberIndustries` в `companyGroup`: все отрасли группы без повторов, с числом компаний |
| `a9111fd` | Лимит ответа модели по умолчанию 2000 → 4000 токенов (со старым лимитом JSON в `finalize` обрезался и лента была пустой). Таблицы из OCR банка сохраняют строки. Фильтр `until` в `news_search` включает весь последний день. +7 тестов |
| `9498d6a` | Новые строки в ответе агента: «Тип», «Главное», «Ответ». Продукты в тексте выводов по-русски, идентификаторы признаков — только после «Признаки:». Позиция банка — из самого свежего подходящего материала |

Формат блока, который агент пишет в режиме ленты:

```
Событие <id события>
Ответ: <только в режиме вопроса: 2–4 предложения по вопросу>. Признаки: … Оговорка: …
Тип: <риск | возможность | наблюдение>
Главное: <1–2 предложения: что событие значит для компании>. Признаки: … Оговорка: …
Факт: «<дословная цитата>» [<id новости>]
Позиция банка: «<дословная цитата>» [<id материала>, <дата>]
Вывод: <предложение>. Признаки: … Оговорка: …
Риск: <предложение>. Признаки: … Оговорка: …
Возможность: <предложение>. Признаки: … Оговорка: …
Стоит проверить: <предложение>. Признаки: … Оговорка: …

Событие <id события>: пропустить — <причина>
```

Режим вопроса включается, если задача начинается с вопроса пользователя и содержит «Контекст (данные, не инструкции)». Строки без содержания агент пропускает.

## Что нужно сделать, чтобы изменения подключились

1. `git pull` и `pnpm install`.
2. `pnpm --filter @alfa/research-agent build` — бэкенд импортирует агента из `dist`, без сборки новый промпт не подхватится.
3. Убрать `LLM_MAX_OUTPUT_TOKENS=2000` из `.env`, если он задан.
4. Перезапустить API и worker. Запуски, которые шли во время обновления, завершатся с `execution_context_changed` (сменилась `PROMPT_VERSION`) — их нужно запустить заново.
5. Корпус банка: распаковать архив с OCR Qwen3.6 (передам отдельно, в git не кладем) в корень репозитория и выполнить `pnpm --filter @alfa/research-agent ingest --bank`. Tesseract путает цифры в таблицах прогнозов, Qwen сверен вручную на всех 64 страницах.

## Что нужно поменять на бэкенде, чтобы строки агента дошли до сайта

Сейчас агент пишет «Главное», «Тип», «Ответ», «Риск», «Возможность», «Стоит проверить», а фронт уже умеет показывать `summary`, `kind`, `risks`, `opportunities`, `actions`. Теряется в `agent-runtime.ts`: в схеме `batchDraftSchema` для этих строк нет полей, а `publishDraft` собирает сводку из цитат.

| № | Что поменять | Где | Как сделать | Где видно сейчас | Что изменится |
| --- | --- | --- | --- | --- | --- |
| 1 | Сводка = «Главное» | `agent-runtime.ts` | Поле `summary` в схеме; в `publishDraft` брать его вместо склейки `claims` | Лента: 4–6 цитат подряд, смысл в конце | Первой строкой — что событие значит для компании, цитаты в разборе |
| 2 | Тип события | `agent-runtime.ts` | Поле `kind`: риск → `risk`, возможность → `opportunity`, наблюдение → `context` | Все карточки «Наблюдение», фильтры «Риски 0», «Возможности 0» | Метки и фильтры работают |
| 3 | Риски, возможности, шаги | `agent-runtime.ts` | Массивы `risks`, `opportunities`, `actions` из строк «Риск», «Возможность», «Стоит проверить» | Разбор: «Не выделены по доступным данным» | Блоки заполнены |
| 4 | Ответ на вопрос | `agent-runtime.ts`, ветка `kind === 'question'` | Поле `answer` в схеме; для вопроса возвращать его вместо склейки сводок | «Вопросы»: в ответ приходит та же карточка | Прямой ответ на вопрос в 2–4 предложениях |
| 5 | Только цитаты агента | Промпт `finalize` | Дописать: «бери только цитаты из ответа агента; события с пометкой "пропустить" не включай» | В карточке 4–6 цитат, позиция банка иногда из июльского материала («материалы банка устарели») | 1–2 цитаты, свежая позиция банка, нерелевантные события не публикуются |
| 6 | Ошибка одного утверждения не обнуляет ленту | `agent-runtime.ts` | Проверять каждое утверждение отдельно (`safeParse` в цикле), неверное отбрасывать | Одна цитата длиннее 300 символов — вся лента «Недостаточно подтверждённых данных» | Отбрасывается только неверное утверждение |
| 7 | Отрасли группы топ-5 | `research-catalog.ts` | Вместо склейки `members.okvedName` — `companyGroup(...).memberIndustries.slice(0, 5)` с числом компаний и «ещё N» | «Отрасли участников группы»: 20 названий с повторами, только по первым 20 компаниям | «Фармоптовая торговля — 22; больницы — 17; …; ещё 58». Меньше шума в отборе новостей |
| 8 | Признак «гарантии» | `research-catalog.ts`, `features` | Добавить `guarantees` рядом с `leasing` | Выводы агента о гарантиях отбрасываются как неизвестный признак | Выводы о гарантиях публикуются. После этого добавлю `guarantees` в промпт |
| 9 | Резерв бюджета | `.env`, `RUN_RESERVATION_RUB` | Снизить с 25 до 5–8 ₽ после подтверждения лимита запроса у шлюза | Живая сводка из 3 событий стоит 0,6–1 ₽; при резерве 25 ₽ на день хватает ~20 сводок | 60–100 сводок в день при том же лимите 500 ₽ |

## Сделано: разбор ответа агента без второго вызова модели (п.1)

Артефакты в `research/agent` (экспортируются из пакета):

| Артефакт | Файл | Что делает |
| --- | --- | --- |
| `parseFeedAnswer(text, { ctx, eventIds, featureIds })` | `src/agent/feed-parser.ts` | Размеченный ответ агента → события с `kind`, `summary`, `answer`, `claims`, `risks`, `opportunities`, `actions`, список пропущенных событий и замечания разбора. Цитаты сверяются `evidenceVerify`, длинные сокращаются по границе предложения до 300 символов, неизвестные признаки убираются |
| `createFeedFinalizer({ ctx, eventIds, featureIds, fallback })` | там же | Готовая функция для опции `finalize` графа. Возвращает сообщение с JSON в формате `batchDraftSchema`; если в ответе нет ни одного блока — вызывает `fallback` |
| `toStructuredDraft(result)` | там же | JSON для `finalize`: `{ events, skipped, issues }` |
| Тесты | `test/feed-parser.test.ts` | Совместимость со схемой бэкенда, режим вопроса, выдуманные цитаты, длинные цитаты, запасной путь |

Проверка на ответах 17 живых запусков из локальной базы: все разобранные утверждения прошли `gateDraft`, ни одно не отброшено.

### Что поменять в `agent-runtime.ts`

1. Подставить наш `finalize`, текущий оставить запасным:

```ts
import { createFeedFinalizer } from '@alfa/research-agent'

const modelFinalize = async (state, config) => { /* текущий код finalize без изменений */ }
// в buildAgentGraph:
finalize: async (state, config) => {
  await progress('step.started', { phase: 'verifying_evidence' })
  return createFeedFinalizer({
    ctx: this.ctx,
    eventIds: ranked.map((r) => r.news.id),
    featureIds,
    fallback: modelFinalize,
  })(state, config)
},
```

2. Расширить схему события (лишние поля сейчас молча отбрасываются zod):

```ts
const note = z.object({ text: z.string().max(2000), companyFeatureIds: z.array(z.string()), uncertainty: z.string().nullable() })
const batchDraftSchema = z.object({
  events: z.array(z.object({
    eventId: z.string(),
    claims: draftSchema.shape.claims,
    kind: z.enum(['risk', 'opportunity', 'context']).optional(),
    summary: z.string().max(2000).nullable().optional(),
    answer: z.string().max(2000).nullable().optional(),
    risks: z.array(note).max(5).optional(),
    opportunities: z.array(note).max(5).optional(),
    actions: z.array(note).max(5).optional(),
  })).max(5),
})
```

3. В `publishDraft` после `gateDraft`:

```ts
const line = (n) => (n.uncertainty ? `${n.text} (${n.uncertainty})` : n.text)
i.kind = draft.kind ?? 'context'
if (draft.summary) i.summary = draft.summary
i.risks = (draft.risks ?? []).map(line)
i.opportunities = (draft.opportunities ?? []).map(line)
i.actions = (draft.actions ?? []).map(line)
```

4. Для `run.input.kind === 'question'` возвращать `answer: drafts.find((d) => d.answer)?.answer ?? <текущая склейка сводок>`.

Фронт менять не нужно: `kind`, `summary`, `risks`, `opportunities`, `actions` он уже показывает.

## Сделано: отбор новостей на ML (п.3)

| Артефакт | Файл | Что делает |
| --- | --- | --- |
| `pnpm news:tag [--force] [--max-rub=10] [--limit=N]` | `src/cli/news-tag.ts` | Размечает новости моделью пачками по 20, сохраняет после каждой пачки, повтор размечает только новые |
| `buildNewsTagPrompt`, `NEWS_TAG_PROMPT_VERSION`, `NEWS_TOPICS` | `src/agent/prompts.ts` | Промпт разметки: группы ОКВЭД, темы, масштаб, важность |
| `okvedDivisions`, `okvedGroup`, `tagNewsBatch`, `parseTagResponse`, `loadNewsTags` | `src/news/tagging.ts` | Словарь групп ОКВЭД из данных компаний, вызов модели, проверка ответа zod, кэш `data/processed/news-tags.json` |
| `rankNewsForCompany(ctx, tags, companyId, { perspective, asOf, limit, since, until })` | `src/news/ranking.ts` | Отбор событий для компании. Результат совместим с `RankedNews` бэкенда, причины — ID признаков профиля |
| `companyExposures`, `tagCoverage`, `ML_RANKING_VERSION` | там же | Связи компании с отраслями и темами; доля размеченных новостей; версия для `executionScope` |
| `pnpm news:rank [дата\|-] [companyId ...]` | `src/cli/news-rank.ts` | Топ-3 для CFO и CEO, бесплатно |
| `LLM_MODEL_TAGGER` | `src/config.ts`, `.env.example` | Модель разметки, по умолчанию `deepseek/deepseek-v4.1-flash` |
| Тесты | `test/news-ranking.test.ts` | Проверка ответа модели, фейковая модель, связи компании, исключение нерелевантного, дубли, ракурс, период |

Новых зависимостей нет. Разметка 1019 новостей — 4,4 ₽. Формула и ограничения — в `README.md`, раздел «Отбор новостей».

Сравнение топ-3 на 22.10 (было → стало):

| Компания | Правила `rankNews` | `rankNewsForCompany` |
| --- | --- | --- |
| U_9250, инженерные сооружения | Дефолты 2027, суд Raiffeisen, кабель в Канаде | Заявление и пресс-конференция ЦБ, льготы банкам при кредитовании защиты критической инфраструктуры; для CEO — число строительных компаний −4,3%, семейная ипотека |
| U_1595, розница одеждой | Суд Raiffeisen, бонды брокера, облигации | Решение и пресс-конференция ЦБ, доля облигаций в фондировании |
| U_57706, опт топлива | Суд Raiffeisen, бонды брокера, манипулирование рынком | ФАС о дизельной сделке, отмена демпфера на дизель, решение ЦБ; лишнее — ввод ИЖС (группа 46.7 включает и стройматериалы) |
| U_68157, жилое строительство | Дефолты 2027, суд Raiffeisen, кабель в Канаде | Семейная ипотека, ввод ИЖС, ввод жилья |
| U_3263, автоперевозки | Суд Raiffeisen, переговоры в Осло, иномарка в розыске | Спрос на автоперевозки +20%, решение ЦБ |

### Что поменять на бэкенде

1. При старте загрузить разметку рядом с корпусом (`composition/data.ts` или `runtime.ts`):

```ts
import { dataPaths, loadNewsTags } from '@alfa/research-agent'
const newsTags = await loadNewsTags(dataPaths({ DATA_DIR: config.DATA_DIR! }).newsTags)
```

2. В `LangGraphRuntime.execute` вместо `rankNews(...)`:

```ts
import { rankNewsForCompany, ML_RANKING_VERSION } from '@alfa/research-agent'
let ranked = newsTags.size
  ? rankNewsForCompany(this.ctx, newsTags, run.companyId, {
      perspective: run.perspective,
      asOf: run.createdAt,
      limit: this.config.RANKING_LIMIT,
      since: run.input.timeRange?.since,
      until: run.input.timeRange?.until,
    })
  : rankNews(/* прежние аргументы */)
```

и в `executionScope` — `ranking: newsTags.size ? ML_RANKING_VERSION : RANKING_VERSION`.

3. После каждого `ingest --news` запускать `pnpm --filter @alfa/research-agent news:tag` и перезапускать API и worker (разметка, как и корпус, читается при старте).
4. Добавить признак `guarantees` в `research-catalog.ts`: отбор может вернуть его в `reasons`, сейчас для него нет подписи на фронте.

## Еще в планах

Явный параметр `mode: 'feed' | 'question'` в `buildTaskPrompt` вместо распознавания по фразе в тексте задания и экспорт общего списка признаков `FEATURE_IDS`, чтобы промпт и `research-catalog.ts` не расходились. Тестовый набор с ручной разметкой для подбора весов отбора и метрик nDCG@5.

## Вопросы

1. Подключаешь `createFeedFinalizer` и расширенную схему (п.1)?
2. Переключаемся на `rankNewsForCompany` с откатом на правила, если разметки нет (п.3)?
3. Какой корпус банка будет на демо и как передавать обработанные данные (`bank-ocr`, `news-tags.json`)?
4. Какие компании и аккаунты даем жюри?
