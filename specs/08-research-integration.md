# Research: аудит и план интеграции

> Исторический аудит/план. Текущее подключение всех экранов, browser sessions, данные и ограничения: [12-product-workspace.md](12-product-workspace.md).


> Реализованы [ranking, PostgreSQL checkpoints, recovery и model journal](11-ranking-and-checkpoints.md); пункты старого аудита про их отсутствие относятся к исходному research CLI.

> Обновление backend: [реализованный контур и ограничения MVP](10-backend-implementation.md). Ниже сохранены исходный аудит и целевые требования; наличие пункта в roadmap не означает отсутствие его MVP-реализации.

## Что изучено

`packages/agent`: data loaders, CSV normalization, RSS/allowlist, bank catalog/OCR, BM25, семь tools, graph/prompts, sources resolver, gateway client и CLI. Исторические артефакты: [smoke 21.10](../packages/agent/results/llm-smoke-2026-10-21.md), [OCR comparison](../packages/agent/results/ocr-compare-2026-10-21/SUMMARY.md). Эти прогоны не повторялись: в текущем checkout нет полного data corpus; новые платные вызовы не выполнялись.

На момент аудита prompt version — `stage1-2026-10-21.8`, граф и tools проверены 10 офлайн-тестами с ScriptedModel/fixtures. Актуальное состояние пакета (промпт `stage1-2026-10-23.8`, 64 теста, holdout и метрики) — [README пакета](../packages/agent/README.md). Это подтверждает базовую механику, но не качество на holdout, production безопасность или актуальную доступность gateway.

## Карта повторного использования

| Код                              | Что уже делает                                       | Что нужно для backend                                                                              |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| data/companies, csv              | Парсинг null/flags/revenue sentinel, связи/платежи   | SQL importer, numeric precision, batch/version/provenance, явное разрешение дублей                 |
| tools/functions company*         | Профиль, группы, концентрация/coverage               | Membership/visibility, DTO adapter, кэш версий; не смешивать ownership и аффилированность          |
| data/news, search/bm25           | RSS, URL/title dedup, русский стемминг, фильтры      | Streaming size cap, timeouts/SSRF hardening, source health, обновление корпуса без простоя         |
| data/bank, bank-catalog, OCR CLI | Страницы/фрагменты, даты, OCR; resumable файлы       | Фоновый admin job, hash-based cache, защищенное object storage, качество OCR/исторические редакции |
| tools/index                      | LangChain tools с Zod и audit; server companyId      | Actor/perspective/corpus version, AbortSignal, quotas, безопасные public events                    |
| agent/graph, prompts             | Собственный bounded цикл и finalization              | Durable checkpoints, строгая остановка/отмена, structured result и publish gate                    |
| agent/sources                    | Эвристическая привязка текстовых сносок к документам | Стабильные citation IDs/locators, права доступа; local paths не выдавать клиенту                   |
| llm                              | Gateway client, reasoning=none, timeout, retries     | Model allowlist, rate/budget reservations, nullable usage/currency, cancellation propagation       |
| cli/run-agent                    | Проверка CLIENT, запуск, сбор usage и JSON file      | Import-safe service method; CLI остается только операторским инструментом                          |

## Модели и предел доказательств

| Роль      | Текущий выбор / ID                                                        | Основание и ограничение                                                                                                                                             |
| --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Агент     | DeepSeek-V4.1-Flash, `deepseek/deepseek-v4.1-flash`                       | Research README: сам завершает анализ, использует группу/контрагентов и более свежую позицию банка. Наблюдение ограниченных прогонов, не общее превосходство модели |
| OCR       | Qwen3.6, `qwen/qwen3.6-35b-a3b`                                           | На четырех вручную проверенных страницах не обнаружены ошибки в числах; полный OCR-прогон 64 страниц описан в отчете. Это не нулевая ошибка на любом PDF            |
| Не выбран | `qwen/qwen3-vl-30b-a3b-instruct`                                          | В отчете потерянные минусы, порядок чисел и дописанный текст; не использовать как автоматический fallback                                                           |
| Кандидаты | `google/gemma-4-26b-a4b-it`, `z-ai/glm-5.3-flash`, `moonshotai/kimi-k2.6` | Имена из списка кейса/gateway snapshot; новых измерений нет                                                                                                         |

`reasoning_effort=none` — выбранная настройка: исследование наблюдало пустые ответы и большой расход при включенном reasoning. Это наблюдение конкретного шлюза, не универсальное свойство всех deployments. Перед live проверить разрешенный model ID через gateway metadata, совместимость tool calling/JSON и доступный бюджет.

## Найденные пробелы

1. **Вывод — текст, не UI DTO.** Жесткая schema, references и bank-position validation отсутствуют. Prompt-only evidence verification не гарантирует фактический вызов и успешную проверку каждой цитаты.
2. **Только company scope.** Наличие configurable.companyId не равно user authorization. CLIENT проверяется CLI, а tools сами не проверяют membership. Нет tenant/user/perspective isolation для HTTP.
3. **Нет долговечности.** graph.compile без checkpointer, output JSON не заменяет checkpoint/lease/outbox. Отмена, retries jobs, SSE replay и crash recovery не реализованы.
4. **Учет стоимости исследовательский.** costOf возвращает 0 без usage.cost, нет глобальной квоты/резерва и явной валюты. Дополнительный финальный LLM-вызов не входит в steps, но расходуется. Не обещать соблюдение 500 ₽/день без общей accounting-системы.
5. **Журнал не готов для браузера.** Raw tool args и sources.where могут содержать локальные пути. Нужны sanitized public summaries и endpoint выдачи документов.
6. **Корпус in-memory/file-based.** Нет production version switch, health SLA, transactional ingestion. У большинства RSS только лид; нельзя показывать «проанализирована вся статья».
7. **Data reasoning.** Код правильно помечает неизвестное направление ВЭД и ненадежные отрасли контрагентов. Эти признаки нельзя потерять в DTO. Scope и доступ к связанным компаниям требуют отдельной политики.
8. **Оценка качества ограничена.** 10 механических тестов и небольшие сравнения не заменяют holdout, adversarial prompt injection и экспертную проверку банковских выводов.

## Порядок переноса

### Шаг 1: данные и read-only API

Согласовать corpus/profile versions, импорт в PostgreSQL, membership/CLIENT. Реализовать me/companies/context/documents. Сохранить unit tests на sentinel 1000, duplicate rows, self-payments, unknown direction/coverage и исторические прогнозы. HTTP DTO адаптирует research, не сериализует его целиком.

### Шаг 2: библиотечная граница

Выделить import-safe agent core с явными exports и build/types. Не импортировать CLI из Fastify и не вызывать tsx/shell. Передать dependencies: DataContext repository, model gateway, audit/event sink, budget/checkpoint stores, AbortSignal. Research CLI использует тот же core; пакет backend не зависит от top-level scripts.

### Шаг 3: job lifecycle

Drizzle runs/events/outbox, BullMQ dispatcher и worker entrypoint в backend. Повторная scope-проверка, lease/heartbeats, общий бюджет, безопасные retries, cancellation и durable checkpoint. Контракты — [04](04-agent-runtime.md).

### Шаг 4: валидируемый insight

Задать JSON schema, сформировать structured output, проверить citations/даты/источники и строго отделить факты, позицию банка и выводы. Если limit/нехватка данных — partial/insufficient_evidence с явными limitations. Затем атомарно опубликовать и сформировать безопасный trace.

### Шаг 5: frontend и диалоги

Подключить read API, saved/feedback, запуск/SSE и question runs через entity adapters. Разнести user authorization и analytic perspective. Ключ cache — user/company/perspective/version. Только после этого убрать demo-notice в live mode; синтетические fixtures не превращать в fallback.

### Шаг 6: приемка

Crash/retry/cancel/reconnect tests, schema/evidence failures, cross-tenant reads, prompt injection, provider timeout без usage, общий бюджет нескольких worker и доступ к изображениям PDF. Затем holdout новых событий/компаний и экспертная оценка влияния. Платные измерения отдельной командой с контролем лимита, не в pnpm test.

## Что не добавлять сейчас

OpenCode/другой автономный harness поверх LangGraph, произвольные MCP-серверы, vector DB/embeddings без baseline и разрешения моделей. BM25 уже реализован; сначала измерить качество и закрыть lifecycle/права. Tool HTTP proxy для модели не заменяет доступ пользователя к предметному API.

### Дополнительные runtime-проверки при переносе

`evidence_verify` ограничивает массив 20 элементами, но его Zod-схема не ограничивает длину quote; текстовое правило «15–300 символов» из описания инструмента нужно закрепить runtime-валидатором. `audited` сейчас журналирует успех и ToolError; неожиданные исключения пробрасываются до добавления audit record. Worker обязан записать sanitized failure и request/run IDs также при таких ошибках.
