# Аккаунты компаний и packages workspaces

Актуальное состояние: 26 октября 2026 (Москва). Спецификация определяет текущий пользовательский доступ без SSO и размещение кода в монорепозитории.

## Размещение кода

```text
projects/
  frontend/       React / TanStack Start / shadcn
  backend/        Fastify / Drizzle / identity / analytics / worker
packages/
  api-client/     @alfa/api-client, generated OpenAPI + openapi-fetch
  agent/          @alfa/agent, graph / tools / CSV / RSS / OCR / ranking
research/         место для будущих agent/MCP-навыков, не pnpm package
specs/            продуктовые и технические спецификации
```

В pnpm workspace входят `projects/*` и `packages/*`. В `projects/` находятся только два запускаемых приложения; весь вспомогательный код вынесен в `packages/`.

## Каталог аккаунтов

Миграции `0002` и `0003` создают `users`, `company_memberships`, `custom_companies` и переименовывают прежнее поле credential в `session_version`. Пароли пользователей не собираются и не хранятся.

`pnpm db:seed` атомарно создаёт отдельный аккаунт для каждого уникального CLIENT в исходном CSV. PROSPECT/CLOSE_CLIENT не получают аккаунты. В текущем наборе — **41 968** профилей; каждый имеет ровно один membership. Повторный сид обновляет имя профиля и восстанавливает membership, не затрагивая созданные пользователями компании.

`GET /v1/accounts?q=...` возвращает до 20 результатов по имени профиля, ID или названию созданной компании. Публичный DTO содержит только `id`, `username`, `companyId`, `companyName`, `source`; финансовые признаки и персональные данные в каталог не входят.

`POST /v1/session { accountId }` открывает выбранный профиль и выдаёт подписанную HttpOnly cookie на 8 часов. Browser не получает служебный session version. Membership перечитывается из PostgreSQL на каждом запросе, поэтому выбранный в URL или теле чужой `companyId` не расширяет scope.

Такой passwordless-каталог — текущая модель доступа продукта без SSO, рассчитанная на обезличенный набор и быструю проверку персонализации. Для контура с реальными клиентскими данными каталог заменяется корпоративной идентификацией, а модули membership и tenant scope остаются теми же.

## Создание пользователя с компанией

На экране доступа две вкладки: **«Готовый профиль»** и **«Новая компания»**. Регистрация состоит из двух шагов:

1. Имя профиля, название компании, отрасль, регион, необязательная выручка за 2025 год и численность.
2. Продукты Альфа-Банка в трёх состояниях (есть / нет / неизвестно), страны внешней торговли.

`POST /v1/registrations` валидирует тело и одной транзакцией создаёт пользователя, пользовательскую компанию и membership. ID генерируются сервером; существующий CSV ID передать нельзя, префикс `client_` зарезервирован для сида. Повтор занятого имени возвращает `409 username_taken` без лишней компании.

После регистрации сервер сразу выдаёт HttpOnly session и открывает рабочее пространство. Новый профиль появляется в общем поиске и после выхода может быть выбран повторно. История, сохранения, feedback и диалоги изолированы по пользователю.

Профиль хранится в `custom_companies.profile`. API и worker загружают его из PostgreSQL в собственный `DataContext` без перезапуска. `profileSource=user` помечает пользовательский ввод; отсутствующие платежи, связи и контрагенты не дополняются данными похожей компании.

## Сессии и сервисный доступ

- Cookie `alfa_session`: signed, HttpOnly, SameSite=Strict, Secure в production, TTL 8 часов.
- Cookie содержит user ID, expiry и fingerprint `session_version`; права остаются на сервере.
- Мутации cookie проверяют `Origin`; CORS должен совпадать с origin frontend.
- Поиск ограничен 60 запросами/минуту/IP, создание сессии — 10, регистрация — 5.
- `token` в `POST /v1/session` и bearer из `AUTH_USERS_JSON` сохранены для CI и сервисных клиентов; в UI они не используются.
- Ответы приватного API получают `Cache-Control: private, no-store`.

## OpenAPI и frontend

Операции `searchAccounts`, `createSession` и `registerUser` входят в OpenAPI. `packages/api-client` генерирует типы для frontend. Поисковый список собран из shadcn `Command`, а форма регистрации — из React Hook Form и shadcn `Tabs`, `Input`, `Select`.

Browser storage содержит только выбранную компанию и ракурс CFO/CEO. Сессия остаётся в HttpOnly cookie; logout очищает Query cache и пользовательские предпочтения.

## Запуск и проверки

```sh
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Для fixture-корпуса используется явный `pnpm db:seed --fixtures`. Проверки покрывают идемпотентный seed, поиск каталога, passwordless session, tenant scope, регистрацию с rollback, повторный вход, новый API process, worker с пользовательской компанией и доступность интерфейса. Платные LLM в этих тестах не вызываются.
