# Новостная аналитика — Alfa Hack 2026

Шаблон pnpm-монорепозитория для персонализированных бизнес-инсайтов. Сейчас здесь только основа приложений; аналитика, агент и предметный интерфейс не реализованы.

```text
specs/                 требования из PDF, архитектура и план реализации
projects/frontend/     React + TanStack Start + полный набор shadcn/ui
projects/backend/      Fastify + Drizzle ORM + PostgreSQL adapter
research/              пустая папка для будущих skills, agent-команд и MCP
```

Начните со [спецификаций](specs/README.md). Исходный [PDF кейса](specs/source/brief.pdf) сохранен вместе с ними. Требования PDF отделены от выбранных технических решений и открытых вопросов.

## Окружение

- Node.js **24.19.0** (`.node-version`), pnpm **11.25.0** (`packageManager`).
- Docker с Compose — для PostgreSQL и контейнерного запуска. Для пустой оболочки база опциональна.
- При отсутствии pnpm: `npm install --global pnpm@11.25.0`. Зависимости зафиксированы в `pnpm-lock.yaml`.

## Локальный запуск

Из корня репозитория:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Frontend — порт 3000, Fastify — 3001. Nitro направляет `/api/*` в Fastify, удаляя префикс `/api`. Страница пока показывает только каркас проекта.

Подключение к базе:

```sh
pnpm infra:up
cp projects/backend/.env.example projects/backend/.env
pnpm dev
```

Не перезаписывайте уже заполненный `.env`. Команды backend читают `.env` из `projects/backend`, а не из корня. Локальные credentials в примере и compose предназначены только для разработки.

```sh
curl --fail http://127.0.0.1:3001/health
curl --fail http://127.0.0.1:3001/ready
curl --fail http://127.0.0.1:3000/api/health
```

`/health` проверяет HTTP-сервис. `/ready` с DATABASE_URL выполняет SQL через Drizzle и возвращает `database: ok` либо HTTP 503. Без URL возвращает `database: not_configured`: это готовность пустого каркаса, не проверка подключения к БД или продуктового сценария.

Остановка: Ctrl+C для dev-процессов, `pnpm infra:down` для контейнеров. Данные PostgreSQL сохраняются в volume; `down -v` удалит их, поэтому в обычном сценарии не используется.

## Проверки и сборка

```sh
pnpm typecheck
pnpm test
pnpm build
```

Проверка типов включает все локальные компоненты shadcn/ui; маршрутный файл генерируется TanStack Router CLI. Тесты проверяют lifecycle Fastify, отсутствие предметных маршрутов и отказ readiness при недоступной БД. Реальное соединение с PostgreSQL проверяется отдельно через `/ready`.

Запуск собранных приложений в двух терминалах:

```sh
pnpm --filter @alfa/backend start
pnpm --filter @alfa/frontend start
```

Frontend собирается с Nitro в `.output/server/index.mjs`; proxy `/api/*` работает в dev и в сборке. `API_PROXY_TARGET` (по умолчанию `http://127.0.0.1:3001`) задается при запуске dev или **во время сборки** frontend. Для production-топологии с другим адресом backend пересоберите frontend с нужным значением или настройте внешний ingress. В текущем шаблоне страница не вызывает предметный API.

## Контейнерный запуск шаблона

```sh
docker compose --profile apps up --build --wait
```

Запускает dev frontend, dev backend и PostgreSQL. Это контейнерная среда разработки, не production image; исходники включаются в image, после изменения нужен rebuild. Порты 3000/3001 должны быть свободны — остановите локальный `pnpm dev` заранее.

`docker compose --profile apps down` останавливает все три контейнера и сохраняет volume. Воркер/Redis еще не добавлены; их место и будущий lifecycle описаны в [архитектуре агента](specs/04-agent-runtime.md).

При сборке за корпоративным TLS-прокси Dockerfile поддерживает необязательный BuildKit secret `extra_ca` с доверенным PEM-сертификатом. Передайте его через локальный Compose override (`build.secrets` и верхнеуровневый `secrets.extra_ca.file`) и при необходимости `--build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY`. CA используется только во время установки; проверка TLS остается включенной. Пути и сертификаты конкретной облачной среды не входят в репозиторий.

## Конфигурация backend

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Адрес HTTP bind |
| `PORT` | `3001` | Порт Fastify |
| `LOG_LEVEL` | `info` | Уровень логирования |
| `CORS_ORIGIN` | `http://localhost:3000` | Разрешенный origin фронтенда |
| `DATABASE_URL` | отсутствует | PostgreSQL connection string; обязателен для Drizzle CLI |

LLM-ключи и MCP-конфигурация пока не нужны: соответствующих интеграций нет. Не храните секреты в Git, PDF-спецификациях и research.

## Drizzle

`projects/backend/src/db/schema.ts` намеренно пуст. Новые предметные таблицы добавляются отдельной задачей:

```sh
pnpm db:generate
pnpm db:migrate
pnpm --filter @alfa/backend db:studio
```

Команды требуют DATABASE_URL из backend `.env` или процесса. SQL-миграции в `projects/backend/drizzle/` следует хранить в Git. Не использовать `push`/reset для общей базы. Сейчас мигрировать нечего.

## shadcn/ui

Все UI-компоненты из реестра стиля `new-york-v4` добавлены в `projects/frontend/src/components/ui/`, включая sidebar, chart, form и combobox; список сохранен в `projects/frontend/shadcn-components.json`. Настроена Alfa-inspired тема: красный для действий, белые поверхности, зелёный для успеха, фиолетовый для AI-аналитики. Светлая и тёмная темы доступны на `/ui-kit`. Компоненты импортируются по месту использования, например `@/components/ui/button`. Готовые страницы/демоблоки и примеры реестра не добавляются: это не отдельные UI-примитивы.

Для последующего обновления или добавления:

```sh
pnpm ui:add button --yes
# Полный повторный импорт: выполняйте осознанно, проверяя diff существующих компонентов.
pnpm ui:add --all --yes
```

### Правила UI-kit

- Используйте компоненты из `@/components/ui/*`, не создавайте дубли кнопок, полей, диалогов и других примитивов.
- Цвета берите из семантических токенов `src/styles.css`: `primary`, `muted`, `success`, `insight`; не прописывайте палитру в страницах.
- `Badge variant="success"` обозначает успешный статус или возможность, `variant="insight"` — AI-интерпретацию. Значение всегда сопровождается текстом/иконкой, не только цветом.
- `brand` — оригинальный красный `#ef3124` из [публичных Alfa primitives](https://github.com/alfa-laboratory/alfa-ui-primitives/blob/master/styles/colors.json). `primary` — чуть более тёмный `#d9291c` для контраста с белым мелким текстом. Зелёные/фиолетовые оттенки — адаптация для продукта, не заявление об официальной палитре банка.
- `ThemeProvider` управляет классом `dark` и сохранением выбранной темы. Обе темы покрывают sidebar, chart, focus, формы и всплывающие поверхности.
- Все компоненты установлены локально; импортируйте только используемые на странице. Полный импорт реестра не означает включение всего UI-kit в каждый экран.
- `/ui-kit` — интерактивная демонстрация, не рабочая аналитика: формы и кнопки показывают демонстрационные уведомления.

## Агентная среда

Предлагается отдельный worker process в пакете backend, BullMQ + Redis, собственный ограниченный агентный цикл и контролируемые tools/MCP. Сейчас это только спецификация. «OpenCoda» предварительно трактуется как OpenCode, выбор не закреплен. PDF запрещает готовые автономные агенты и мультиагентные системы как основной компонент: допустимость технической оболочки надо проверить до интеграции. Разрешенные модели и бюджет 500 ₽/день перечислены в specs.

Сторонние компоненты и статус интеграций: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
