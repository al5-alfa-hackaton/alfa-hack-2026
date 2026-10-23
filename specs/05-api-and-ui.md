# API для frontend и исследовательского агента

**P0 пути реализованы.** Машиночитаемый текущий контракт — [OpenAPI](../packages/api-client/openapi.json), Swagger UI — /docs. Ниже сохранены целевые продуктовые DTO/семантика; отличия MVP (названия run полей, ограниченные окна истории, упрощенное ранжирование и auth) явно описаны в [10](10-backend-implementation.md). Основной frontend demo остается локальным, вкладка /company → Данные сервиса использует generated client. P1 остается планом.

Browser prefix — `/api/v1`; Fastify prefix — `/v1` (Nitro снимает `/api`). Далее пути указаны для Fastify. JSON — UTF-8, время ISO 8601 с timezone, суммы — decimal string + RUB/период. API не возвращает local filesystem paths, ключи, prompts или hidden reasoning.

## Scope и права

`userId`, membership и роль доступа определяет серверная сессия. `companyId` обязан входить в разрешенные компании, статус клиента — CLIENT. Аналитический `perspective=cfo|ceo` соответствует frontend `session.role` и влияет на ранжирование/ракурс, но **не предоставляет новые права**. Все чтения и worker-переходы повторно проверяют scope.

Ключ пользовательского состояния: `(userId, companyId, perspective, insightId, insightVersion)`. Local storage demo не является механизмом авторизации. В live-режиме данные одного пользователя не должны оставаться в браузере другого после logout.

## P0: ручки для существующего интерфейса

| Экран / действие                      | Метод и путь                                                                          | Ответ и реализация                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Начальная загрузка, company switcher  | `GET /v1/me`                                                                          | User, разрешенные perspectives/capabilities, default company; без секретов                                          |
| Поиск/выбор компании                  | `GET /v1/companies?query=&cursor=&limit=20`                                           | Только membership + CLIENT; безопасный displayName (при отсутствии названия — synthetic ID), отрасль, nextCursor    |
| Контекст в sidebar, rail и `/company` | `GET /v1/companies/:companyId/context`                                                | Versioned profile, features, gaps, источники, group scale с основанием; адаптер `companyProfile`                    |
| `/` и фильтры                         | `GET /v1/companies/:companyId/insights?perspective=cfo&kind=risk&q=&cursor=&limit=20` | Snapshot version, items, counts по kind до фильтра kind, matchedCount, nextCursor, freshness, limitations, dataMode |
| Открыть разбор / deep link            | `GET /v1/insights/:insightId?perspective=cfo`                                         | Полный versioned Insight DTO, citations и собственные saved/feedback flags; повторная проверка company scope        |
| Обновить сводку                       | `POST /v1/analysis-runs`                                                              | `202`, создание run/outbox в транзакции; Idempotency-Key; запуск worker отдельно                                    |
| Прогресс / reconnect                  | `GET /v1/analysis-runs/:runId/events`                                                 | SSE сохраненных events с sequence и Last-Event-ID, без raw provider tokens                                          |
| Fallback polling                      | `GET /v1/analysis-runs/:runId`                                                        | State, phase, progress, stopReason, result reference, error/retry/reset metadata                                    |
| Отмена                                | `POST /v1/analysis-runs/:runId/cancel`                                                | `202 cancelling`, `200 cancelled` при повторе; `409 already_terminal`, если результат уже опубликован               |
| `/history`                            | `GET /v1/companies/:companyId/analysis-runs?perspective=cfo&cursor=`                  | История scope с status, времени, duration, nullable usage/cost; не глобальный журнал                                |
| `/saved`                              | `GET /v1/companies/:companyId/saved-insights?perspective=cfo&cursor=`                 | Сохраненные версии и доступность исходников                                                                         |
| Сохранить                             | `PUT /v1/me/saved-insights/:insightId`                                                | Body perspective/version; идемпотентно `200` с savedAt                                                              |
| Убрать закладку                       | `DELETE /v1/me/saved-insights/:insightId?perspective=cfo&version=`                    | Идемпотентно `204`                                                                                                  |
| Полезность + замечание                | `PUT /v1/insights/:insightId/feedback`                                                | rating useful/not_useful/null, comment, perspective, version; сохранять оценку и текст раздельно                    |
| Диалог по событию                     | `GET /v1/insights/:insightId/conversation?perspective=cfo&cursor=`                    | Разрешенные сообщения, conversation ID и version; без других компаний/ролей                                         |
| Уточняющий вопрос                     | `POST /v1/insights/:insightId/questions`                                              | `202 runId, conversationId`; Idempotency-Key; тот же worker, insight/profile/corpus context                         |
| Источники                             | `GET /v1/documents/:documentId?page=1&offset=0&length=2000`                           | Разрешенный фрагмент, date, title, sourceKind, contentExtent, locator, безопасный external URL; length <=4000       |
| Сверка OCR PDF                        | `GET /v1/documents/:documentId/pages/:pageNumber/image`                               | Авторизованный PNG/stream; проверенные IDs, запрет обхода пути. Не принимать filename от клиента                    |
| Ход анализа                           | `GET /v1/insights/:insightId/trace`                                                   | Public step summaries, tools/outcomes, document refs, versions; никаких secret args или private reasoning           |

Маленький TXT-экспорт frontend уже формирует из отфильтрованных разрешенных данных; отдельная серверная ручка ему не нужна. Перед переключением на live запрещено экспортировать синтетические данные при ошибке API.

## P1: развитие на основе research

| Метод и путь                                                       | Для чего / адаптер                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `GET /v1/companies/:id/group?limit=20`                             | Участники и аффилированность: companyGroup; отдельная policy на видимость связанных компаний                 |
| `GET /v1/companies/:id/counterparties?direction=both&limit=10`     | companyCounterparties; показывать coverage и industriesReliable, не только красивую диаграмму                |
| `GET /v1/companies/:id/sources?q=&kind=news&since=&until=&cursor=` | Пользовательский просмотр разрешенного корпуса; адаптер newsSearch/bankSearch, не публичный LLM tool gateway |
| `POST /v1/company-questions`                                       | Вопрос о компании без конкретного инсайта: отдельный runKind, те же scope/limits/worker                      |

`evidence_verify` — серверный внутренний инструмент, публичная ручка для произвольных documentId/quotes не нужна. Ingestion, OCR и обновление каталогов — admin-only jobs/CLI; не кнопка любого клиента и не часть каждого вопроса.

## Контракт создания run

```json
{
  "companyId": "U_12345",
  "perspective": "cfo",
  "kind": "refresh_feed",
  "timeRange": { "since": "2026-10-01T00:00:00Z", "until": "2026-10-22T00:00:00Z" }
}
```

Сервер фиксирует profile/corpus/prompt versions, разрешенную модель, deadline и бюджет. В request нет model URL, системного prompt, shell, API key или userId. Для вопроса: `{ "question": "...", "perspective": "cfo", "insightVersion": "..." }`, 1..1000 символов после trim.

```json
{
  "runId": "run_01",
  "status": "queued",
  "statusUrl": "/v1/analysis-runs/run_01",
  "eventsUrl": "/v1/analysis-runs/run_01/events",
  "dataMode": "research"
}
```

Клиент строит browser URL с `/api`, не открывает внутренний Fastify hostname. В live используется тот же контракт с `dataMode=live`; браузерное demo имеет отдельный adapter, явно отмеченный в UI.

## Insight DTO

Обязательные поля: `id`, `version`, `schemaVersion`, `companyId`, `perspective`, `runId`, `generatedAt`, `dataMode`, `profileVersion`, `corpusVersion`, `status` (complete/partial/insufficient_evidence).

Содержание:

- `event`: id/title/happenedAt и fact claim IDs.
- `relevance`: score 0..1, rank и reasons с feature IDs; это не probability of truth.
- `summary`, `claims[]`: kind fact/bank_position/ai_inference, text, evidenceIds, companyFeatureIds, uncertainty.
- `risks[]`, `opportunities[]`, `possibleActions[]`: текст + связанные claim IDs, horizon если известен.
- `bankPosition`: available/missing/stale/conflicting, material dates и claim IDs. При отсутствии материала — явный missing, не заполнение моделью.
- `evidence[]`: documentId, sourceKind, quote, publishedAt, locator(page/offset), verification outcome, contentExtent.
- `missingData[]`, `limitations[]`, nullable usage/cost с валютой и certainty.

Проверки публикации: references существуют и доступны; bank_position опирается на bank source; совпавшая цитата не доказывает логическую истинность всего вывода; неподтвержденный claim не публикуется как факт. structured-output validation и проверка citations выполняются вне модели.

## SSE и согласованность

Типы: run.queued, step.started, tool.completed, run.progress, run.completed, run.partial, run.failed, run.cancelled. Envelope: `{ id, runId, sequence, at, type, payload }`; событие и SQL-изменение согласованы транзакционно. Sequence уникален внутри run. Клиент дедуплицирует/replays, не добавляет два ответа при reconnect.

После terminal event клиент перечитывает результат по ID. Потеря SSE — «связь прервана, восстанавливаем», а не мгновенная ошибка анализа. Heartbeat не выдается за прогресс. Проценты только при известном знаменателе; агентные steps показывать фазами. Старую сводку не уничтожать до атомарной публикации новой.

## Ошибки и UI

Форма: `{ "code": "budget_exhausted", "message": "...", "requestId": "...", "retryable": false, "resetAt": "..." }`. Details — безопасные поля, без stack/provider response. 400 validation, 401 session required, 403 forbidden scope, 404 unavailable resource, 409 idempotency/terminal conflict, 429 rate/budget, 503 transient dependency. Политика 403/404 для cross-tenant должна предотвращать перебор чужих ресурсов.

Соответствие UI: queued/running → Progress + Cancel; partial → ограничения рядом с результатом; no events → Empty; unavailable → Alert + понятный retry; budget → resetAt без бесконечного автоповтора; denied → скрыть чужие данные; stale → дата и прежняя сводка; cancelled → история без публикации нового результата. Browser demo уже проверяет эти переходы, но не заменяет backend contract tests.
