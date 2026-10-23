# Этапы реализации и качество

> Исторический аудит/план. Текущее подключение всех экранов, browser sessions, данные и ограничения: [12-product-workspace.md](12-product-workspace.md).


> Обновление backend: [реализованный контур и ограничения MVP](10-backend-implementation.md). Ниже сохранены исходный аудит и целевые требования; наличие пункта в roadmap не означает отсутствие его MVP-реализации.

## Завершено

- pnpm workspace, технический Fastify/Drizzle scaffold и полный UI-набор.
- Frontend demo cycle из codex/mock-app-cycle, переработанные UX/визуальная система и слои по rules.md.
- Отдельное research: loaders, BM25, tools, LangGraph, OCR и зафиксированные model comparisons.
- Функциональные browser tests, offline unit tests и проверка frontend import boundaries. Точные команды — в README; платные сравнения не запускаются из общего test script.

Это три независимые части, не завершенный live E2E продукт.

## План внедрения

1. **Данные/read API:** schema/migrations, versioned import, memberships, CLIENT, me/companies/context/documents. Сохранить неизвестное направление ВЭД, sentinel 1000, coverage, исторические редакции.
2. **Core boundary:** вынести import-safe graph/tools из CLI, добавить exports/build contract и DI для репозиториев/модели/аудита. Существующий CLI сохраняется для исследования.
3. **Durable jobs:** runs/outbox/events/checkpoints, BullMQ/Redis, worker entrypoint в backend, lease, cancel, retry, rate limits и общий бюджет.
4. **Публикация:** structured DTO, evidence/provenance gate, ranking/кластеризация новых событий, bank-position freshness, partial/insufficient evidence.
5. **Frontend integration:** entity API adapters, server cache с user/company/perspective keys, SSE/reconnect, saved/feedback/conversations. Никакого молчаливого возврата synthetic fixtures при ошибке live API.
6. **Сдача:** полный compose с worker/Redis, auth/test accounts или явно обозначенный demo auth, synthetic E2E, notices, precise commit/tag. Доступ жюри к private repo — alfa-hack-2026 (PDF, с. 8).

## Проверки по границам

| Уровень  | Обязательная проверка                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Data     | null/false/0, sentinel 1000, duplicate IDs, самоплатежи, unknown direction, incomplete group revenue/coverage                           |
| API      | membership на каждом ресурсе, CLIENT, validation, cursor, perspectives отдельно от access role, idempotency conflicts                   |
| Agent    | tools возвращаются в граф, лимиты с дополнительной финализацией, schema-invalid output, непроверенные citations, conflicting bank dates |
| Worker   | повторная доставка, crash/restart, lease expiry, checkpoints, cancel во время tool/LLM, не публиковать отмененное                       |
| Budget   | одновременные worker, usage.cost отсутствует/неизвестная валюта, timeout с неопределенным расходом, daily reset                         |
| UI       | реальная навигация/deep links, focus return, keyboard, поиск/фильтры, сохранение и scope, замечание отдельно от rating                  |
| SSE      | duplicate/reordered events, Last-Event-ID, offline/reconnect, polling fallback, отсутствие raw sensitive payloads                       |
| Security | prompt injection в news/OCR, SSRF, forbidden documents/pages, role escalation, log redaction и session cleanup                          |

Для frontend выполняются unit tests, architecture check и Playwright. Axe проверяет основной экран в светлой/темной теме; это автоматическая проверка части WCAG, не сертификат полной доступности. Просмотр 1440/768/390 и снимки дополняют автоматизацию. Проверка research — fixtures/ScriptedModel; это не live-модельная оценка.

## Качество результата

Отдельный holdout по новым компаниям/отраслям/событиям. Экспертная разметка влияния, а не только LLM-evaluation. Метрики: Recall@k/nDCG@k, relevance по компании/роли, factual errors, доля claims с валидными источниками, неверное присвоение AI-вывода банку, полнота/полезность, p50/p95 run time, queue wait, retry/cancel rates, стоимость/сутки.

Реализовано в `packages/agent` (23.10): отложенная выборка новых компаний и отраслей, P@3/R@5/nDCG@5 по компании и роли, точность цитат, присвоение вывода ИИ банку, числа без источника, форма ответов, стоимость и время; отчет по журналам сервиса `pnpm monitor:report`. Результаты — [ML-часть](../packages/agent/README.md#оценка-качества), процесс и цели — [мониторинг качества](../docs/quality-monitoring.md). Экспертная разметка пока не выполнена.

Пороговые значения установить после baseline. Четыре OCR-страницы и несколько агентных вопросов не доказывают общее качество; нельзя писать «OCR безошибочен». При каждой смене модели/prompt/corpus версионировать данные и повторять релевантный regression set.

## Открыто

Production auth/SSO, storage/retention и политика доступа к аффилированным компаниям; актуальная квота/валюта gateway, выдача test credentials, права на хранение внешних текстов, freshness/SLA и deployment. Сырой dataset должен предоставляться безопасно вне Git. Vector search/MCP добавлять только при доказанной необходимости и разрешенных моделях; BM25 уже есть.
