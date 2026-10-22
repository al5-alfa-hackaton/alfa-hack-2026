# Новостная аналитика · Альфа Бизнес

События рынка в контексте конкретной компании: что произошло, почему это важно, где риски и на чем основан вывод.

[![Персональная сводка событий](docs/screenshots/feed-desktop.png)](docs/screenshots/feed-desktop.png)

**Интерактивное демо:** две учебные компании, два аналитических ракурса, шесть событий. Frontend работает целиком в браузере. Исследовательский агент в `research/agent` запускается отдельно; его соединение с API и интерфейсом еще предстоит реализовать. Вымышленные показатели и тексты не являются данными клиента или позицией Альфа-Банка.

[Быстрый запуск](#запуск) · [Сценарий проверки](#что-попробовать) · [Архитектура](specs/07-frontend-architecture.md) · [Нужные API](specs/05-api-and-ui.md) · [Research](research/agent/README.md)

## От события к решению

В ленте сразу видно влияние на бизнес и признак, из-за которого событие попало в сводку. Разбор отделяет факт, интерпретацию, позицию банка и пробелы данных. Источники, уточняющие вопросы и обратная связь находятся рядом с результатом.

[![Разбор влияния события](docs/screenshots/insight-reader.png)](docs/screenshots/insight-reader.png)

<details>
<summary>Источники, уточнение, профиль компании и мобильная версия</summary>

### Первоисточники

![Источники с учебными фрагментами](docs/screenshots/sources.png)

### Вопрос в контексте события

![Уточняющий диалог](docs/screenshots/conversation.png)

### Профиль и границы данных

![Контекст компании](docs/screenshots/company-desktop.png)

### Мобильная сводка

<img src="docs/screenshots/feed-mobile.png" alt="Мобильная версия: компания, фильтры, событие и объяснение влияния" width="390" />

### Темная тема

![Темная тема](docs/screenshots/feed-dark.png)

</details>

Снимки сделаны Chromium с работающего приложения, без дорисовки интерфейса. Все показанные компании и события — synthetic fixtures. [Повторить съемку](#скриншоты).

## Запуск

Node.js **24.19.0**, pnpm **11.25.0**. Версии: `.node-version`, `packageManager`, `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfa/frontend dev
```

Frontend слушает порт **3000**. Для демо не нужны backend, PostgreSQL, API key или исходные CSV. При отсутствии pnpm: `npm install --global pnpm@11.25.0`.

Оба сервиса: `pnpm dev`. Для базы:

```sh
pnpm infra:up
# Только если файла еще нет; существующую конфигурацию не перезаписывать.
cp projects/backend/.env.example projects/backend/.env
pnpm dev
```

Backend — **3001**. Nitro проксирует `/api/*` в Fastify, снимая `/api`; `API_PROXY_TARGET` задается при dev-запуске или сборке frontend. Сейчас приложение не вызывает предметный API.

## Что попробовать

1. Откройте ленту «Север Металл» в роли финансового директора. Разберите первое событие и откройте его источники.
2. Перейдите во вкладку «Вопросы», спросите о рисках, оцените полезность и оставьте замечание. В демо ответы сценарные, не от LLM.
3. Сохраните событие, откройте «Сохранённое», обновите страницу. Состояние останется в этом браузере.
4. Смените компанию на «Город Маркет»: изменятся порядок и объяснения. Чужие сохранения/диалоги не появятся. Аналогично проверьте роль генерального директора.
5. Обновите сводку, отмените запуск и откройте историю. Через кнопку «Сценарии демо» проверьте partial, empty, error, budget и denied; после ошибки можно вернуться к обычному анализу.
6. Поиск учитывает заголовок, категорию и причину релевантности. Ctrl/Cmd+K переводит в поиск. TXT-экспорт содержит только отфильтрованные события.
7. Прямая ссылка `/?insight=rate` открывает разбор; Escape закрывает его и возвращает фокус. На телефоне навигация открывается из верхней панели.

Маршруты: `/`, `/saved`, `/company`, `/history`, `/ui-kit`. Компания, аналитическая роль, saved, chats, ratings, remarks и история изолированы по scope и валидируются Zod при восстановлении из localStorage. Плохое/недоступное хранилище отображается явно. Local storage **не является авторизацией**.

## Устройство репозитория

```text
projects/
  frontend/src/
    app/              routing, providers, styles
    pages/            композиция экранов
    blocks/           законченные пользовательские сценарии
    components/       shadcn/ui и generic-компоненты
    entities/         company, insight, analysis, workspace
    shared/           технические hooks/lib
  backend/            Fastify, Drizzle, пустая предметная схема
research/agent/       CSV/RSS/OCR, BM25, tools, собственный LangGraph-агент
specs/                продукт, данные, API и план интеграции
docs/screenshots/     снимки и инструкции воспроизведения
```

Архитектура клиента: [правила и границы](specs/07-frontend-architecture.md). Нижний слой не импортирует верхний; модули используют публичные index.ts, страницы не импортируют друг друга, runtime-циклы запрещены. Эти ограничения проверяются скриптом при typecheck. Framework-generated route tree имеет собственные соглашения именования.

В проекте сохранены все **61 компонент shadcn/ui**. Навигация, модальные поверхности, фильтры, поля, сообщения, таблицы и состояния составлены из готовых компонентов. [UI-kit](projects/frontend/src/pages/ui-kit) использует ту же тему. Для добавления: `pnpm ui:add <component> --yes`; перед обновлением существующих исходников проверяйте diff.

Дизайн основан на [Taste Skill](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill) и [Better Web UI](https://github.com/aladicf/better-web-ui), с учетом собственной темы Альфа Бизнес. [Контекст дизайна](.better-web-ui.md), [решения и проверки](specs/09-ui-review.md).

## Проверки

```sh
pnpm typecheck                      # все пакеты + границы frontend
pnpm test                           # frontend, backend, research: офлайн
pnpm build                          # frontend SSR и backend
pnpm --filter @alfa/frontend test:e2e
```

Для Playwright нужен Chromium. Первый запуск: `pnpm --filter @alfa/frontend exec playwright install chromium`. С уже установленным системным браузером:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend test:e2e
```

E2E проверяет поиск, фильтры, сохранение/изоляцию, прямые ссылки и фокус, вопросы/feedback, экспорт, отмену/историю, сценарии ошибок, mobile и автоматическую доступность светлой/темной темы. Сервер запускается автоматически или переиспользуется, если уже работает. Платных LLM-вызовов и OCR в этих проверках нет.

Собранные сервисы: `pnpm --filter @alfa/backend start` и `pnpm --filter @alfa/frontend start`. Nitro output: `.output/server/index.mjs`. Внешний адрес backend задавайте при сборке через `API_PROXY_TARGET`.

## Скриншоты

```sh
pnpm --filter @alfa/frontend dev
# В другом терминале:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend screenshots
```

Скрипт использует отдельный browser context с чистым localStorage, фиксированные viewport и synthetic fixtures. Он воспроизводит реальные клики и ждет загрузки шрифтов/интерфейса. Артефакты — `docs/screenshots`; traces/test-results не коммитятся.

## Backend и инфраструктура

```sh
curl --fail http://127.0.0.1:3001/health
curl --fail http://127.0.0.1:3001/ready
curl --fail http://127.0.0.1:3000/api/health
docker compose --profile apps up --build --wait
```

`/health` — HTTP liveness. `/ready` с DATABASE_URL проверяет SQL и возвращает `database=ok` или 503; без URL сообщает `not_configured`. Это готовность scaffold, не предметного продукта.

Compose поднимает dev frontend/backend/PostgreSQL, порты 3000/3001 должны быть свободны. После изменения исходников нужен rebuild. `docker compose --profile apps down` сохраняет volume. `down -v` удаляет данные и не используется в обычном workflow.

Dockerfile поддерживает необязательный BuildKit secret `extra_ca` для доверенного CA корпоративного TLS-прокси: локальный Compose override с build.secrets/secrets.file и при необходимости стандартные proxy build args. TLS-проверка остается включенной; сертификаты и конфигурация конкретной среды не попадают в Git.

Backend `.env` читается из `projects/backend`. Переменные: HOST=0.0.0.0, PORT=3001, LOG_LEVEL=info, CORS_ORIGIN=http://localhost:3000, optional DATABASE_URL. Пример локальных credentials — только для разработки. `pnpm db:generate`, `pnpm db:migrate` требуют DATABASE_URL; предметных таблиц пока нет. Не сбрасывайте общую базу.

## Research и следующие шаги

[Исследовательский агент](research/agent/README.md) уже умеет читать профили/связи, искать новости и материалы банка, использовать OCR и собственный bounded LangGraph-цикл. Исторические отчеты: [модели](research/agent/results/llm-smoke-2026-10-21.md), [OCR](research/agent/results/ocr-compare-2026-10-21/SUMMARY.md). Исходные CSV, PDF банка, OCR тексты и run outputs хранятся вне Git.

Frontend пока не вызывает этого агента. [Нужные API и DTO](specs/05-api-and-ui.md), [worker/очередь](specs/04-agent-runtime.md), [аудит и порядок переноса research](specs/08-research-integration.md) описывают следующий этап. Нужны auth/membership, import-safe agent core, durable runs, бюджет, structured output и проверка источников. Не запускайте готового автономного агента как основной компонент: PDF требует собственную агентную логику и только разрешенные модели.

[Все спецификации](specs/README.md) · [Исходный кейс](specs/source/brief.pdf) · [Сторонние компоненты и лицензии](THIRD_PARTY_NOTICES.md)
