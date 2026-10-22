# Новостная аналитика · Альфа Бизнес

События рынка в контексте компании: факты, персональная интерпретация, источники и ограничения.

[![Контекст компании из набора организаторов](docs/screenshots/company-desktop.png)](docs/screenshots/company-desktop.png)

Рабочие экраны подключены к Fastify API: лента, сохранённое, профиль, история, разбор, источники, вопросы и обратная связь. Состояние хранится в PostgreSQL. Вход без SSO — по выданному администратором ключу, с HttpOnly сессией.

Анализ выполняется собственным LangGraph-агентом в отдельном BullMQ worker. Ранжирование учитывает профиль и ракурс CFO/CEO; checkpoints и журнал вызовов сохраняются в SQL. Для генерации нужны настроенный разрешённый LLM gateway и подтверждённый предел стоимости запроса. Без них интерфейс показывает недоступность нового анализа, а профиль и ранее полученные результаты остаются доступны. Подмена ответа учебными данными исключена.

[Запуск](#запуск) · [Данные и OCR](#данные-и-ocr) · [Устройство](specs/12-product-workspace.md) · [API](specs/05-api-and-ui.md) · [Research](research/agent/README.md)

## Запуск

Node.js **24.19.0**, pnpm **11.25.0**, Python 3 для загрузки набора и локальной выдачи доступа.

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfa/research-agent build
python3 scripts/fetch-data.py
pnpm --filter @alfa/research-agent ingest
# Создаёт/дополняет локальную .env; ключ выводится только в игнорируемый файл.
python3 scripts/create-access.py --companies U_1595
pnpm infra:up
pnpm db:migrate
pnpm dev
```

Откройте http://localhost:3000 и введите ключ из `.local/access-key-local-owner.txt`. Backend — порт **3001**. Nitro проксирует `/api/*` в Fastify. Swagger: http://localhost:3001/docs. `CORS_ORIGIN` должен совпадать с origin frontend; для другого адреса API используйте `API_PROXY_TARGET` при dev/сборке frontend.

Скрипт выдачи доступа проверяет, что переданные компании являются CLIENT в скачанном наборе. Он не перезаписывает существующий аккаунт и не печатает ключ. Несколько компаний: `--companies U_1595 другой-ID`. Ключи и memberships на сервере задаёт `AUTH_USERS_JSON`; произвольный ID из браузера не предоставляет доступ.

Чтобы включить генерацию, заполните `projects/backend/.env` по [.env.example](projects/backend/.env.example): `AGENT_PROVIDER=langgraph`, `LLM_BASE_URL`, `LLM_API_KEY`, разрешённая модель и `LLM_GATEWAY_REQUEST_CAP_RUB`. Последняя переменная подтверждает установленный оператором шлюза жёсткий предел, а не устанавливает его. Резерв должен покрывать `(AGENT_MAX_STEPS + 2) × cap`.

Перезапустите API и отдельно запустите `pnpm worker`. Production требует HTTPS и `NODE_ENV=production`; `DEV_AUTH` и `fixture` запрещены. SSO/OIDC и самостоятельное управление пользователями пока не подключены. [Сессии и ограничения](specs/12-product-workspace.md).

## Данные и OCR

Ссылки находятся в [исходном PDF](specs/source/brief.pdf): [CSV, с. 15](https://drive.google.com/drive/folders/1Ep8wWoEHTg5Q8kwrLx2j_xFyxGUEVxFq), [материалы банка, с. 17](https://drive.google.com/drive/folders/15xZTLF1lZ65p6o5xpNA_fRbxjoV-UlG1). Загрузчик проверяет размеры файлов и записывает SHA-256 manifest. `data/raw` и `data/processed` исключены из Git и Docker context.

Проверено в этой среде: 85 525 строк компаний, 9 PDF/64 страницы, 1 037 RSS-публикаций из 7 источников. Два источника не ответили корректно. Названия организаций обезличены: интерфейс показывает идентификаторы из набора, не вымышленные бренды.

PDF — сканы. Для локального OCR нужен Tesseract с языками `rus+eng`:

```sh
pnpm --filter @alfa/research-agent ingest --bank
python3 scripts/ocr-bank.py
pnpm --filter @alfa/research-agent ingest --bank
```

Если языковые файлы находятся отдельно, задайте `TESSDATA_PREFIX`. Скрипт возобновляется по документам и не вызывает LLM. В этой среде получено 193 фрагмента. OCR не гарантирует безошибочность распознавания; reader позволяет проверить страницу. После обновления корпуса перезапустите API и worker. В окружении с HTTP-прокси Node 24 может потребовать `NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1`; TLS-проверку не отключайте.

## Рабочий сценарий

1. Выберите доступную компанию и ракурс CFO/CEO. Профиль показывает реальные признаки и неизвестные значения.
2. Обновите сводку. Задание продолжится после закрытия страницы; его состояние и отмена доступны в истории. До завершения видна предыдущая сводка.
3. Откройте разбор: факт, AI-вывод, позиция банка, основания приоритета, ограничения и цитаты разделены.
4. Сохраните событие, задайте вопрос, оцените ответ или оставьте замечание. Данные доступны вашему аккаунту после reload и с другого устройства.
5. Поиск и TXT-экспорт работают по текущим загруженным событиям. Ctrl/Cmd+K фокусирует поиск; ссылка `?insight=<UUID>` открывает сохранённый разбор.

![Рабочая область](docs/screenshots/feed-desktop.png)

Снимки сняты Chromium с реальным набором и отключённой генерацией до настройки LLM. Сообщение о недоступности анализа отражает конфигурацию среды. [Мобильная версия](docs/screenshots/feed-mobile.png), [тёмная тема](docs/screenshots/feed-dark.png), [вход](docs/screenshots/login.png). Нет дорисованных ответов или подставных финансовых показателей.

```sh
SCREENSHOT_ACCESS_KEY_FILE=.local/access-key-local-owner.txt PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend screenshots
```

## Устройство и проверки

pnpm workspaces: `projects/frontend` (React/TanStack Start/shadcn), `projects/backend` (Fastify/Drizzle/BullMQ/LangGraph), `projects/api-client` (generated OpenAPI), `research/agent` (CSV/RSS/OCR/BM25/tools/graph), `specs`.

Frontend: `app → pages → blocks → components → entities → shared`, TanStack Query, все 61 компонент shadcn/ui. Backend: модули companies/analytics с domain/application/infrastructure/presentation. Направление импортов и циклы проверяются автоматически. UI-kit доступен только в dev. [Архитектура](specs/07-frontend-architecture.md), [backend](specs/10-backend-implementation.md), [ranking/checkpoints](specs/11-ranking-and-checkpoints.md).

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:check
RUN_INTEGRATION=true TEST_DATABASE_URL=postgresql://alfa:alfa_local_only@127.0.0.1:5432/alfa pnpm test:integration
```

Playwright использует настоящий API/worker с явно заданным fixture provider и отдельным тестовым аккаунтом. Для воспроизводимого запуска смотрите [.github/workflows/ci.yaml](.github/workflows/ci.yaml): `E2E_ACCESS_KEY` должен совпадать с ключом тестового аккаунта, `CORS_ORIGIN=http://127.0.0.1:3000`, затем `pnpm --filter @alfa/frontend test:e2e`. CI проверяет вход, SQL persistence, диалоги, источники, ranking, ошибки, mobile и часть WCAG через axe; платные LLM не вызываются.

`pnpm infra:up` поднимает PostgreSQL/Redis. `docker compose --profile apps up --build` запускает dev-контейнеры с локальной server env и read-only `data/`; без настройки LLM не включайте worker (`docker compose --profile apps up --build frontend backend`). Миграции применяются отдельным job. Volumes сохраняются; `down -v` удаляет данные. Dockerfile поддерживает необязательный BuildKit secret `extra_ca` для доверенного корпоративного CA.

[Все спецификации](specs/README.md) · [Research](research/agent/README.md) · [Сторонние компоненты и лицензии](THIRD_PARTY_NOTICES.md)
