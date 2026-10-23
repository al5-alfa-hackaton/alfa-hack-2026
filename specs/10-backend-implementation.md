# Реализованный backend · 22 октября 2026

> Текущие SQL-аккаунты, вход по паролю, регистрация компании и структура packages описаны в [13-accounts-and-packages.md](13-accounts-and-packages.md). Описание входа по ключу ниже относится к предыдущему этапу; token остаётся для сервисных клиентов.


Основа — [архитектура пользователя](source/fastify-modular-clean-architecture.md), продуктовые требования, API-план и код `packages/agent`. Этот документ описывает исполняемое состояние; требования следующих этапов остаются в 04–08.

> Обновлено: [ранжирование и checkpoints реализованы](11-ranking-and-checkpoints.md). Ниже — базовая реализация и ее актуализированные ограничения.

## Модули и зависимости

```text
projects/backend/src/
  app.ts, server.ts, worker.ts
  composition/                   явная сборка зависимостей и загрузка corpus
  plugins/                       auth и OpenAPI streaming metadata
  infrastructure/database/       Drizzle client и SQL schema
  modules/
    companies/
      application/               CompanyCatalog port, Companies use cases
      infrastructure/            ResearchCatalog adapter
      presentation/              схемы и HTTP routes
      companies.module.ts, index.ts
    analytics/
      domain/                    Run, Insight, Evidence, Claim и состояния
      application/               Analytics, AnalyticsStore, AgentRuntime, Documents ports
      infrastructure/            PostgreSQL, LangGraph/fixture, authorized documents
      presentation/              Zod schemas, REST и SSE
      analytics.module.ts, index.ts
  shared/kernel/                 Principal, AppError, scope invariant
```

`presentation → application → domain`; infrastructure реализует application ports. Fastify/Drizzle/Redis/LangChain не импортируются в application/domain. Межмодульные связи — через `index.ts`; concrete adapters создаются в composition root. `pnpm typecheck` автоматически проверяет эти границы. Два бизнес-контекста: каталог компаний и аналитическая рабочая область (runs, публикация сводки, пользовательские действия).

## HTTP и типы

Реализованы все P0 пути таблицы [05](05-api-and-ui.md): `/me`, каталог/context, feed/detail, runs/status/history/cancel/events, saved, feedback, conversation/questions, documents/images и sanitized trace. `/health` — liveness; `/ready` требует доступные SQL-таблицы после миграции и Redis. Наличие worker проверяется операционным мониторингом, не `/ready`.

- Swagger UI: `http://localhost:3001/docs`, JSON: `/docs/json`.
- Fastify Zod request/response schemas → OpenAPI → `openapi-typescript` → `@alfa/api-client` (`openapi-fetch`).
- Артефакты: `packages/api-client/openapi.json`, `src/schema.d.ts`; вручную не редактировать.
- `pnpm contracts:generate` обновляет контракт; `pnpm contracts:check` обнаруживает drift в Git.
- Browser использует `/api/v1`, Nitro снимает `/api`. Entity API модулей company/analysis использует generated operations; shared transport не содержит business DTO.
- Все рабочие экраны используют API: feed/saved/context/history/detail/documents/trace/questions/feedback. Browser fixtures и отдельная вкладка сервиса удалены; TanStack Query управляет cache/polling. [Обновление продукта](12-product-workspace.md).
- Pagination catalog — по ID. Feed — по ID в snapshot. History, bookmarks, conversation пока ограничены последними 100 записями; cursor pagination history/bookmarks работает внутри этого окна. Conversation возвращает окно целиком. Это ограничение MVP, не бесконечная история.

## SQL, очередь и согласованность

Drizzle-миграции создают девять таблиц: `analysis_runs`, `run_events`, `run_outbox`, `daily_budgets`, `insights`, `feed_snapshots`, `insight_user_states`, `conversation_messages`, `agent_model_calls`. Native saver отдельно создает таблицы в `agent_checkpoints`. SQL constraints защищают ключи, FK, status и неотрицательный бюджет.

Создание run, budget reservation, первое событие, outbox и user question атомарны. Advisory lock + UNIQUE(user, idempotency key) защищают конкурентные одинаковые запросы; другое тело с тем же ключом дает 409. Параметризованные Drizzle/SQL запросы не интерполируют пользовательский SQL.

Worker — отдельный процесс того же backend-пакета. Dispatcher публикует outbox в BullMQ с `jobId=runId-generation`; повторная доставка не запускает уже claimed run. Повтор транспорта допускается до claim; **модель автоматически заново не запускается**. Lease 45 секунд, heartbeat 500 мс, watchdog восстанавливает безопасный run, а при неизвестном paid call или исчерпанном recovery limit завершает его с явной ошибкой. Runtime timeout по умолчанию 180 секунд. Redis настроен с AOF и `noeviction`.

Отмена queued run сразу освобождает резерв; running → cancelling → cancelled через AbortSignal. Публикация и отмена конкурируют за row lock. Результат, snapshot и terminal event публикуются одной транзакцией; более старый завершившийся refresh не заменяет более новый. Старая сводка сохраняется при ошибке/отмене; saved версии доступны после следующих refresh. События получают монотонный sequence и поддерживают SSE replay, Last-Event-ID и heartbeat. Поллинг — полноценный fallback.

Графовые checkpoints теперь сохраняются через PostgreSQL PostgresSaver; безопасные потерянные runs автоматически восстанавливаются. Journal ответов предотвращает повторные платные вызовы после сохраненного ответа. Неизвестный исход запроса завершает run как model_call_uncertain. [Подробная семантика](11-ranking-and-checkpoints.md).

## Research и публикация

`@alfa/agent` получил import-safe exports, build и declarations. Backend не запускает CLI через shell. Используются существующие LangGraph, BM25, seven typed tools и model allowlist кейса. AbortSignal и RunnableConfig явно проходят в модель; у live-адаптера `maxRetries=0`, чтобы не умножать стоимость скрытыми повторами. CFO/CEO и временной диапазон включаются в задачу; question получает исходный insight и последние сообщения собственной conversation.

После graph invoke выполняется отдельная структурирующая model call. Zod ограничивает draft; сервер проверяет цитаты по corpus. Фактический текст должен целиком совпадать с частью проверенной цитаты; bank_position требует bank document. AI inference требует известный company feature с непустым значением и явную uncertainty. Публичный summary собирается из прошедших проверку claims, а не из необработанного ответа модели. Невалидные claims исключаются; результат обозначается partial/insufficient_evidence. `complete` означает прохождение программных проверок, а не экспертное доказательство финансового вывода.

Банк без подтвержденных материалов имеет статус missing; старше 90 дней — stale (MVP policy). Source resolver с локальными путями не используется. Документы выдаются только после проверки связанного разрешенного insight; image route принимает ID и номер страницы, а не filename. Логи/trace не содержат prompts, raw arguments, provider tokens или private reasoning.

Ранжирование по явным правилам выбирает несколько событий до LLM: профиль, perspective, свежесть, качество источника, period. Score/components/explanations/version сохранены в DTO. Обучение/калибровка на реальном holdout и экспертная оценка остаются следующим этапом.

## Auth и бюджет

Bearer accounts задаются только сервером в `AUTH_USERS_JSON`: id, случайный token минимум 32 символа, разрешенные companyIds. Токен сравнивается по SHA-256 digest constant-time. Права на company + CLIENT проверяются в use cases, на run — также userId; worker повторяет проверку account/company. `perspective` не право доступа.

`DEV_AUTH=true` допускается только вне production и дает локального пользователя с U_1/U_3. `AGENT_PROVIDER=fixture` использует синтетические CSV и новость из репозитория, не тратит бюджет и никогда не является fallback при ошибке live. Production запрещает оба shortcut. Добавлены POST/DELETE session, HttpOnly подписанная cookie на 8 часов, Secure в production, SameSite=Strict и проверка Origin. Bearer accounts продолжают работать. SSO/OIDC и SQL membership administration остаются вне текущего контура; [подробности](12-product-workspace.md).

Дневной global SQL ledger: 500 RUB максимум, смена дня в 00:00 UTC / 03:00 Москвы. Для live run атомарно резервируется `RUN_RESERVATION_RUB`, по умолчанию 25. Неизвестная валюта provider usage.cost не превращается в RUB или нулевую стоимость: DTO возвращает cost/currency=null и certainty=unknown; после начала run весь резерв считается расходом. Для queued cancellation резерв возвращается.

Live startup требует подтвержденный оператором **hard per-request gateway cap** `LLM_GATEWAY_REQUEST_CAP_RUB`; резерв должен покрывать `(maxSteps + 2) * cap` (граф, limit finalization, structured call). Эта переменная — подтверждение внешнего ограничения, а не команда gateway. Без действительно настроенного ограничения внешнего gateway нельзя обещать жесткий рублевый потолок. До подтверждения backend отказывает в live старте; также нужны DATA_DIR, LLM_BASE_URL и LLM_API_KEY.

## Запуск и проверка

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfa/agent build
# Скопировать только при отсутствии .env:
cp projects/backend/.env.example projects/backend/.env
pnpm infra:up
pnpm db:migrate
pnpm dev
# отдельный терминал
pnpm worker
```

Полностью контейнерный dev-вариант: `docker compose --profile apps up --build --wait`; одноразовый migrate предшествует API/worker. Перед этим освободить 3000/3001. Общие данные не удалять.

```sh
pnpm typecheck
pnpm test
RUN_INTEGRATION=true TEST_DATABASE_URL=postgresql://alfa:alfa_local_only@127.0.0.1:5432/alfa pnpm test:integration
TEST_BACKEND=true PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend test:e2e
pnpm build
pnpm contracts:check
```

Integration создает собственную временную БД и уникальный Redis queue prefix, применяет реальные миграции, поднимает отдельный worker и очищает только свои ресурсы. TEST_DATABASE_URL должен указывать на local admin database с CREATE DATABASE. Обычный `pnpm test` пропускает инфраструктурные тесты; платные вызовы не выполняются. Локальный OpenAI-compatible fake gateway проверяет реальный LangGraph/OpenAI adapter с tool calling, usage и final validation.

Перед production нужны OIDC/session, SQL membership, gateway quota contract, реальный corpus и live smoke, ingestion/version rollout, retention/backup/metrics для checkpoints и model journal, нагрузочные проверки, улучшение ranking и полное подключение frontend. Текущий Dockerfile — dev image.

## Результаты проверки этой реализации

- Typecheck всех пакетов и автоматические проверки границ слоев — проходят.
- 36 офлайн-тестов: 9 frontend, 17 backend, 10 research.
- 14 integration-тестов с PostgreSQL/Redis и отдельным worker — проходят.
- 17 Playwright-сценариев, включая typed API → очередь → worker → SQL, — проходят.
- `pnpm build` и `pnpm contracts:check` — проходят; OpenAPI содержит 18 paths / 19 operations.
- Docker-образ собран, контейнер API проверен через реальный HTTP → очередь → worker → SQL. Полный одновременный Compose smoke уперся в размер writable layers Docker VFS в этой cloud-среде; исходники/SQL volumes сохранены, временные app-контейнеры и build cache убраны. Для всех процессов в Compose используется один общий image.
- Платный live gateway, полный исходный corpus и production SSO не проверялись. GitHub Actions workflow добавлен; локальная проверка не выдается за уже завершившийся remote CI.
