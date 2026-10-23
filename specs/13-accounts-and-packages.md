# Аккаунты компаний и packages workspaces

Актуальное состояние: 23 октября 2026 (Москва). Дополняет спецификацию 12 и заменяет её вход по ключу как основной пользовательский сценарий.

## Размещение кода

```text
projects/
  frontend/       React / TanStack Start / shadcn
  backend/        Fastify / Drizzle / identity / analytics / worker
packages/
  api-client/     @alfa/api-client, generated OpenAPI + openapi-fetch
  agent/          @alfa/agent, tools / graph / CSV / RSS / OCR / ranking
research/         место для будущих исследований, не pnpm package
specs/
docs/dataset-accounts.md
```

В pnpm workspace входят projects/* и packages/*. Импорты агента — @alfa/agent. Build/typecheck/tests, contract generator, Dockerfile и ссылки используют новые пути. Сервисные domain/application модули остаются внутри backend; пользовательские UI-модули — внутри frontend.

## Учетные записи

Миграция 0002 добавляет users, company_memberships, custom_companies. Логин уникален и нормализуется в нижний регистр. Пользователь получает компании только из SQL memberships. Введённые браузером companyId, имя компании или выбранный ракурс не дают дополнительных прав.

Сид pnpm db:seed создаёт отдельный аккаунт для каждого уникального CLIENT в исходном CSV. PROSPECT/CLOSE_CLIENT не получают аккаунты; дубликаты synthetic ID не создают лишних пользователей. В текущем наборе создано 41 968 аккаунтов.

Логин — client_<ID в нижнем регистре>, например client_u_1595. У каждого аккаунта ровно одна компания. Случайные пароли записываются в docs/dataset-accounts.md; повторный сид читает существующий файл, сохраняет пароли и восстанавливает однозначные memberships. Сид применяется одной SQL-транзакцией, вставляет записи пакетами, не трогает пользовательские аккаунты и компании. При конфликте логина транзакция откатывается.

Опубликованные пароли предназначены для проверки продукта на обезличенном наборе. В production ALLOW_DATASET_LOGIN по умолчанию false; явное включение допускается конфигурацией. Пароли созданных формой пользователей в Markdown не попадают. Сгенерированные dataset passwords содержат 144 случайных бита, в SQL хранится SHA-256 digest. Человеческие пароли хешируются scrypt с отдельной случайной солью.

## Создание пользователя с компанией

На экране входа две вкладки: «Войти» и «Создать аккаунт». Регистрация состоит из двух шагов:

1. Логин/пароль/подтверждение, название компании, отрасль, регион, необязательная выручка за 2025 год и численность.
2. Продукты Альфа-Банка в трёх состояниях (есть / нет / неизвестно), страны внешней торговли. Направление торговли не предполагается.

POST /v1/registrations валидирует тело и атомарно создаёт пользователя, новый профиль и единственный membership. Произвольный существующий ID передать нельзя; server UUID отделяет новый профиль от CSV. Префикс client_ зарезервирован для сида. Повтор занятого логина — 409 username_taken; не остаётся лишней компании.

После регистрации выдаётся HttpOnly session cookie и открывается рабочее пространство новой компании. Она не наследует чужие истории, сохранения, feedback или диалоги. Пользователь может выйти и войти тем же логином/паролем; данные сохраняются.

Профиль хранится в custom_companies.profile. API и worker читают его из PostgreSQL и добавляют в собственный DataContext до анализа. Поэтому создание не требует перезапуска процессов. Контекст содержит profileSource=user; reader/profile отмечают самостоятельный ввод. Graph tools получают оговорку, что сведения не проверены банком. Отсутствующие платежи, связи и контрагенты не подменяются данными похожей компании.

## Сессии и API

POST /v1/session принимает username/password. Прежний token и bearer из AUTH_USERS_JSON поддерживаются для сервисных клиентов. Browser UI использует логин и пароль. DELETE /v1/session удаляет cookie.

Cookie подписана AUTH_SESSION_SECRET, действует 8 часов, HttpOnly, SameSite=Strict, Secure в production. Права перечитываются из SQL; fingerprint хеша пароля в cookie позволяет отклонить прежнюю сессию после смены пароля. Публикация новых аккаунтов не меняет подпись всех сессий. В production секрет обязателен; сид генерирует его в игнорируемой .env, если он ещё не задан.

Login ограничен 10 запросами/минуту/IP, registration — 5. Проверяется Origin; API персональных данных отвечает private, no-store. Пароли и хеши не возвращаются DTO и не пишутся в request logs. CORS_ORIGIN должен совпадать с origin frontend.

Новые запросы и profileSource включены в OpenAPI; frontend берёт RegistrationInput из generated operations. Form state обслуживает React Hook Form; Select/Tabs/Input — shadcn. Browser storage содержит только предпочтения компании/ракурса.

## Запуск и проверки

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfa/agent build
python3 scripts/fetch-data.py
pnpm infra:up
# Создать projects/backend/.env из .env.example, если её нет.
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Для изолированных тестов: AGENT_PROVIDER=fixture, pnpm db:seed --fixtures --credentials /tmp/alfa-fixture-accounts.md. Такой режим требует отдельный путь, чтобы не перезаписать основной список паролей.

Проверки покрывают seed/reseed, разные memberships, вход по паролю, отказ чужому companyId, регистрацию и duplicate rollback, внедрение scope, новый API process, настоящий worker с зарегистрированной компанией, неизвестные значения и frontend accessibility. Платные LLM не входят в эти тесты.
