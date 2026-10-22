# Спецификации новостной аналитики

Актуализировано 22 октября 2026 по `main` (`ce96f03`), `codex/mock-app-cycle` (`44dcfa1`), коду frontend и `research/agent`. [Исходный PDF](source/brief.pdf) — источник продуктовых требований; приложенный пользователем `rules.md` — основа архитектуры клиента.

## Реализовано

- **Frontend:** `/`, `/saved`, `/company`, `/history`, `/ui-kit`; компании/роли, фильтры и поиск, разбор, источники, вопросы, оценки и замечания, экспорт, история, отмена и ошибочные состояния. Шесть синтетических событий, с отдельной вкладкой «Данные сервиса» на /company. Основные demo-экраны пока локальные. Данные изолированы по компании/роли и хранятся локально.
- **Research:** CLI-пакет `@alfa/research-agent`: CSV и связи, RSS, OCR PDF, BM25 с русским стеммингом, семь tools и собственный LangGraph-цикл. [Код и инструкции](../research/agent/README.md). Raw/processed данные вне Git. Офлайн-тесты работают на fixtures.
- **Backend:** Fastify/Drizzle/PostgreSQL, `/health`, `/ready`. P0 REST/SSE, server-side bearer scope, SQL migrations, BullMQ/Redis worker, global budget reservations, LangGraph adapter и generated frontend types. [Текущее состояние и ограничения](10-backend-implementation.md).

Fixture-проверки не означают выполненный платный live-прогон. Отчеты о моделях — исторические прогоны 21 октября, не новые измерения текущей сессии.

| Документ                                                   | Содержание                                 |
| ---------------------------------------------------------- | ------------------------------------------ |
| [01-product.md](01-product.md)                             | Требования PDF, сценарии и приемка         |
| [02-architecture.md](02-architecture.md)                   | Стек, текущие границы и целевой deployment |
| [03-data.md](03-data.md)                                   | Семантика CSV, происхождение и хранение    |
| [04-agent-runtime.md](04-agent-runtime.md)                 | Граф, worker, очередь, отмена и бюджет     |
| [05-api-and-ui.md](05-api-and-ui.md)                       | Ручки и контракты для каждого экрана       |
| [06-delivery-and-quality.md](06-delivery-and-quality.md)   | Этапы реализации и проверки                |
| [07-frontend-architecture.md](07-frontend-architecture.md) | Слои по rules.md, состояние и замена моков |
| [08-research-integration.md](08-research-integration.md)   | Аудит research и перенос в backend         |
| [09-ui-review.md](09-ui-review.md)                         | Дизайн-решения и браузерная проверка       |

[10-backend-implementation.md](10-backend-implementation.md) — исполняемый backend, модульная архитектура, генерация контрактов, auth, очередь и воспроизводимые проверки.

[11-ranking-and-checkpoints.md](11-ranking-and-checkpoints.md) — ранжирование нескольких событий, durable LangGraph checkpoints, lease fencing, recovery и journal платных вызовов.

## Решения

1. Сохраняем React/TanStack Start/shadcn, Fastify/Drizzle/PostgreSQL и pnpm.
2. Развиваем собственную логику research; LangGraph — библиотека orchestration, а не готовый автономный OpenCode-агент. Ограничения PDF на готовых агентов остаются в силе.
3. Длительный анализ — отдельный процесс backend-пакета, BullMQ/Redis. Два прикладных сервиса; research — экспериментальный пакет.
4. Browser обращается к `/api/v1/*`; Nitro снимает `/api`, Fastify принимает `/v1/*`.
5. Выбранная роль CFO/CEO становится `perspective`, а не правом доступа. Membership проверяет сервер.
6. Вывод публикуется после валидации структуры и источников. CLI-текст, local path и одна совпавшая цитата не являются готовым безопасным DTO.
7. Платные OCR/comparison не входят в обычные тесты. Бюджет 500 ₽/день и разрешенные модели следуют PDF; действующие API IDs и наблюдения — в [08](08-research-integration.md).
