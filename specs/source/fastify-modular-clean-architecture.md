# Fastify Backend — Modular Monolith + Clean Architecture

> Стандарт проекта для Fastify + TypeScript. Можно сохранить как `ARCHITECTURE.md` и давать AI-агенту как обязательные правила. В этом репозитории также есть минимальный исполняемый пример модуля `users`.

## 0. Коротко о решении

**Стиль:** Modular Monolith (один деплой) + Clean Architecture (изолированные зависимости внутри каждого модуля). Подходит как базовая архитектура для большинства средних и больших backend-проектов.

**Цель:** разделить бизнес-контексты и оставить domain/application независимыми от Fastify, ORM, SQL, Redis, брокеров сообщений и других внешних механизмов.

**Не цель:** создавать microservices, DI-контейнер, event bus, CQRS или десятки интерфейсов до возникновения реальной потребности.

**Типичный поток запроса:** `HTTP -> Fastify route -> Use Case -> Port -> Adapter -> DB`, после чего результат преобразуется в HTTP response. В *исходном коде* направление зависимостей другое: внешний adapter зависит от application port, а application ничего не знает об adapter.

## 1. Важнейшие правила

1. Модуль = один бизнес-контекст (`users`, `orders`, `payments`, `auth`). Не делить проект по общим папкам `controllers/services/repositories` на верхнем уровне.
2. У каждого модуля есть **публичный контракт** (`index.ts`, фасад или exported application port). Внешние модули не импортируют его `domain`, `infrastructure`, `presentation` и приватные use cases напрямую.
3. `domain/` — чистый TypeScript: сущности, value objects, инварианты, доменные события, чистые доменные сервисы. Запрещены Fastify, ORM, HTTP, environment variables, глобальные DB-клиенты.
4. `application/` — сценарии работы: команды/запросы, use cases, application DTO, порты (`interfaces`). Зависит от domain и стабильных общих примитивов, не от конкретной инфраструктуры.
5. `infrastructure/` — реализации портов: SQL/ORM repositories, Redis adapters, external API clients, broker publishers. Может импортировать application contracts и domain entities.
6. `presentation/` — Fastify routes, schema validation, HTTP request/response mappers, auth guards. Не обращаться к DB/Prisma напрямую и не размещать здесь бизнес-правила.
7. `composition/`, `app.ts` и/или `<module>.module.ts` — единственные места создания конкретных зависимостей, связывания интерфейсов с реализациями и регистрации модулей.
8. DI по constructor/factory injection. Не использовать без крайней необходимости service locator, global singleton state или DI decorators.
9. Прямое обращение между модулями — только через объявленное API/порт. Для асинхронной интеграции разрешены события с версионируемыми контрактами.
10. Новая абстракция оправдана только если фиксирует реальную границу, контракт, тестируемость или заменяемый механизм.

## 2. Схема зависимости кода

```text
                   composition root (app.ts)
                  /          |           \
       presentation    infrastructure    module assembly
             |               |                |
             v               v                v
         application <--- adapters implement its ports
             |
             v
           domain
```

Строго: `domain` не импортирует `application`, `presentation` или `infrastructure`. `application` не импортирует `presentation/infrastructure`. Presentation не импортирует конкретный repository и не вызывает SQL напрямую. Infrastructure не знает об HTTP.

`shared/kernel` может быть известен внутренним слоям, если он содержит только чистые фундаментальные типы.

## 3. Каноническая структура

```text
src/
├── app.ts                    # Создать Fastify, зарегистрировать плагины и модули
├── server.ts                 # Запустить listen, обработать сигналы и остановку
├── config/                   # Парсинг и валидация env на старте
├── composition/              # Глобальная сборка конкретных адаптеров
├── plugins/                  # Fastify plugins: security, auth, docs, telemetry
├── infrastructure/           # Общие технические компоненты
│   ├── database/
│   ├── cache/
│   ├── messaging/
│   └── observability/
├── modules/
│   └── users/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value-objects/
│       │   ├── services/
│       │   └── events/
│       ├── application/
│       │   ├── use-cases/
│       │   ├── ports/
│       │   └── dto/
│       ├── infrastructure/
│       │   ├── repositories/
│       │   └── integrations/
│       ├── presentation/
│       │   ├── users.routes.ts
│       │   ├── users.schemas.ts
│       │   ├── users.mapper.ts
│       │   └── users.error-map.ts
│       ├── users.module.ts   # Сборка use cases и routes
│       └── index.ts          # Только публичный контракт
└── shared/
    ├── kernel/               # Чистые базовые types/errors (минимум)
    └── http/                 # Не знает о бизнес-модулях

tests/
├── unit/
├── integration/
└── e2e/
```

Демо в этом архиве компактнее: пустые директории из канонической схемы не создаются.

## 4. Содержимое каждого слоя

### 4.1 Domain

**Содержит:**
- Entities — объекты с бизнес-идентичностью (`User`, `Order`).
- Value Objects — неизменяемые значения с инвариантами (`Email`, `Money`, `OrderStatus`).
- Domain Services — правила, которые не относятся к одной сущности.
- Domain Errors и, при необходимости, Domain Events.

**Правила:**
- Каждое бизнес-ограничение выражено здесь или, если это оркестрация процесса, в use case.
- Не импортировать Fastify, Prisma, Redis, `process.env`.
- Не возвращать HTTP-статусы и ORM records.
- Использовать `Date`, ID и случайность через входные данные/порты там, где это нужно для детерминированного тестирования.

### 4.2 Application

**Содержит:**
- Один use case на бизнес-операцию, например `CreateUserUseCase`, `CancelOrderUseCase`.
- Порты (`UserRepository`, `Mailer`, `Clock`, `IdGenerator`).
- Commands/Queries и application DTO, если нужны.
- Транзакционную оркестрацию и авторизацию на уровне бизнес-действия (не только проверки JWT).

**Правила:**
- Публичный метод, обычно `execute(command): Promise<result>`.
- Не получать `FastifyRequest`, `FastifyReply`, HTTP cookies, headers и ORM model.
- Не читать env и не создавать инфраструктурные объекты в конструкторе use case.
- Не делать неатомарный `find -> insert` для гарантии уникальности: adapter/DB обязаны обеспечивать ограничение на уровне хранения.

### 4.3 Infrastructure

**Содержит:**
- `PostgresUserRepository implements UserRepository`, `RedisOtpStore`, `HttpPaymentGateway`.
- ORM-to-domain и domain-to-persistence mappers.
- Преобразование ORM/SQL/network ошибок в осмысленный контракт порта.

**Правила:**
- Никакого `FastifyRequest/Reply`.
- Никакой бизнес-логики, не относящейся непосредственно к корректному сохранению/восстановлению.
- Уникальные ограничения и транзакции должны быть корректны при нескольких экземплярах сервера.
- Не экспортировать DB records наружу модуля.

### 4.4 Presentation

**Содержит:**
- Fastify plugin с роутами.
- JSON Schema / TypeBox / Zod для схем HTTP-границы.
- HTTP input -> application command, application output -> HTTP response.
- HTTP authentication adapter (парсинг токена, получение principal), маппинг ошибок в HTTP.

**Правила:**
- Route максимально тонкий: validate -> use case -> map -> reply.
- Валидация формата на входе не заменяет бизнес-инварианты domain.
- Не отдавать наружу persistence entities, секретные поля или stack trace.
- Обязательно ограничивать поля response, корректно проектировать коды `200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`, `500`.

## 5. Fastify-специфика

1. `buildApp(deps)` создаёт Fastify и регистрирует плагины; **не** вызывает `listen()`. Отдельный `server.ts` читает config, собирает зависимости и вызывает `listen()`.
2. Каждый бизнес-модуль регистрируется как Fastify plugin: `app.register(createUsersModule(deps), { prefix: '/v1/users' })`.
3. По умолчанию `register()` создаёт новый encapsulation context для hooks/decorators/schema. Не оборачивать обычные feature plugins в `fastify-plugin` без причин: он может нарушить ожидаемую инкапсуляцию.
4. Глобальную инфраструктуру подключать в корневой контекст осознанно. Передавать зависимости через factory/constructor предпочтительнее, чем вытягивать их через `fastify.decorate()` во всех слоях.
5. Использовать полные JSON Schema (`type: 'object'`, `properties`, `required`) — актуально для Fastify 5.
6. `setErrorHandler` регистрировать на нужном уровне контекста. 404 на несуществующий маршрут отдельно обрабатывается `setNotFoundHandler`, если нужен единый формат.
7. Использовать `app.inject()` для HTTP integration tests, без реального порта.
8. Async проверки, требующие DB, выполнять в use cases или подходящих hooks, не внутри синхронной схемной валидации.

Документация: https://fastify.dev/docs/latest/Reference/Encapsulation/ ; https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ ; https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/ ; https://fastify.dev/docs/latest/Reference/Server/

## 6. Dependency Injection и жизненный цикл

**На старте:** `config -> database clients -> concrete repositories -> use cases -> Fastify routes -> listen`.

Порты — обычные TypeScript-интерфейсы. В production адаптеры создаются один раз на app lifecycle, если они thread-safe/request-safe. DB pool живёт столько же, сколько приложение; закрывать его в `onClose` или в shutdown-коде.

**Scoped/Request data:** `currentUser`, correlation ID, trace context, transaction-bound repository нельзя хранить в изменяемых глобальных полях singleton-сервисов. Передавать в command/context явным аргументом или организовать request-scoped composition.

**В тесте:** заменить repository/clock/idGenerator/transport на фейки или in-memory adapters через `buildApp(...)`.

## 7. Пример полного запроса: POST /v1/users/

```text
Request { email, name }
  -> Fastify validates createUserBodySchema
  -> users.routes.ts extracts data
  -> CreateUserUseCase.execute({ email, name })
  -> domain.createUserEntity() normalizes/validates business invariants
  -> UserRepository.create(user) // atomic uniqueness contract
  -> InMemoryUserRepository / PostgresUserRepository
  <- User
  -> presentation mapper (Date -> ISO, allowlisted fields)
  <- HTTP 201 JSON
```

Если email уже существует, repository возвращает `false`, use case выбрасывает `EmailAlreadyExistsError('EMAIL_ALREADY_EXISTS')`, а HTTP mapping отдаёт `409`.

См. файлы:
- `src/modules/users/domain/user.ts`
- `src/modules/users/application/use-cases/create-user.use-case.ts`
- `src/modules/users/application/ports/user-repository.ts`
- `src/modules/users/infrastructure/in-memory-user.repository.ts`
- `src/modules/users/presentation/users.routes.ts`
- `src/modules/users/users.module.ts`
- `src/app.ts`

## 8. Репозитории, транзакции и конкурентность

**Repository — порт с бизнес-семантикой**, а не CRUD-обёртка над каждой таблицей. Например, `reserveStock(orderId, items)` может быть более правильной операцией, чем универсальный `update(...)`.

**База данных:** хранит ограничения с `UNIQUE`, `FOREIGN KEY`, `CHECK`, транзакциями. Если уникальный email — бизнес-правило, добавь уникальный индекс по нормализованному email. Проверка `SELECT` перед `INSERT` сама по себе не защищает от гонки.

**Unit of Work / Transaction Manager:** вводить, когда один use case атомарно меняет несколько агрегатов/таблиц. Контракт транзакции располагается в application и адаптируется инфраструктурой; не протаскивать Prisma transaction object в use cases. Для нескольких внешних систем одной SQL транзакции недостаточно.

**Асинхронные события:** при необходимости надежного publish после DB commit рассмотреть transactional outbox, idempotency keys и retry policy. Не отправлять необратимое внешнее действие внутри долгой DB-транзакции.

**Пагинация:** запросы чтения должны проектировать paging/cursors на уровне application DTO и adapter; не возвращать все записи автоматически.

### Пример SQL-ограничения для реального адаптера

Пример DDL для PostgreSQL (вариант, не обязательный для in-memory демо):

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

В адаптере при выполнении `INSERT` преобразуй нарушение уникальности email (PostgreSQL SQLSTATE `23505`, с проверкой имени конкретного уникального constraint) в результат `false` из `UserRepository.create()`. Все остальные ошибки пробрасывай/отображай как инфраструктурные ошибки. В реальном проекте учитывай case-insensitive uniqueness, нормализацию email, конкретную миграцию, корректный multi-instance доступ и необходимые ограничения на поля.

## 9. Межмодульное взаимодействие

**Синхронно (простое):** `orders` зависит от публичного `UsersReader` API, а composition root внедряет реализацию. `orders` не импортирует `users/infrastructure/...` и не обращается к таблице users напрямую через свой repository, если это нарушает ownership.

**Асинхронно (когда действительно нужно):** `orders` публикует бизнес-событие `OrderPlaced` через порт; `notifications` подписывается через infrastructure. Контракт события версионируется, обработчики идемпотентны.

Не создавать общий `shared/services` с прямыми импортами множества модулей. Это превращает монолит в скрыто связанный граф.

## 10. Ошибки и API

- Domain/Application выбрасывает framework-agnostic typed errors с устойчивым `code`.
- Presentation либо generic root HTTP mapper превращает их в статус и безопасный JSON.
- Пример формата:

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "This email is already registered",
    "requestId": "req-123"
  }
}
```

- Для неожиданных ошибок — `500 INTERNAL_ERROR`, без раскрытия stack trace, SQL, токенов или секретов в response.
- Логировать внутреннюю ошибку вместе с request/correlation ID; не логировать passwords, access tokens, cookies, платежные реквизиты.
- `404` от `GET /v1/users/:id` и `404` от отсутствующего HTTP-маршрута — разные случаи и могут требовать отдельной обработки.

## 11. Безопасность

- Проверять `Authorization` на HTTP-границе и бизнес-права внутри use case.
- Не считать факт валидного JWT достаточным правом изменить чужой заказ.
- Добавить rate limiting, CORS allowlist, CSRF-защиту где применимо, безопасные cookies, secret management.
- Ограничивать размер request body, пагинацию, сортировку и сложность фильтров.
- Пароли хэшировать современным password hashing algorithm; никогда не возвращать hash.
- Валидация не заменяет SQL parameters и ограничения БД.
- Все внешние HTTP-вызовы: таймаут, abort, controlled retries, circuit breaking по необходимости.

## 12. Тестовая стратегия

| Что тестируем | Вид теста | Чем заменяем |
|---|---|---|
| Domain инварианты | Unit | Не нужен Fastify/DB |
| Use cases | Unit | Fake `Repository`, `Clock`, `IdGenerator` |
| HTTP contracts | Fastify inject | In-memory adapters, stubbed auth |
| Реальный SQL mapper/constraints | Integration | Тестовая PostgreSQL/контейнер |
| Путь через все слои | E2E | Настоящая test DB, внешние системы в sandbox |

Важные кейсы для `users`: успешное создание; duplicate email (409); invalid body (400); unknown id (404); нормализация email; ошибка адаптера; конкурентная запись в настоящую БД.

## 13. Как добавлять новую фичу

1. Назови бизнес-контекст и владельца данных. Реши, новый модуль это или use case существующего.
2. Запиши вход, выход и бизнес-инварианты use case.
3. Реализуй domain модели/правила и unit tests.
4. Определи минимально необходимый application port и use case.
5. Добавь production adapter в infrastructure (с ошибками, таймаутами, ограничениями, транзакциями).
6. Добавь Fastify route + schema + mapper; не добавляй business rules в route.
7. Свяжи всё в `<module>.module.ts` и composition root.
8. Добавь unit, integration, HTTP tests; проверь security, request IDs, логи, метрики.
9. Экспортируй из `index.ts` только необходимые публичные элементы.
10. Перед PR проверь, что imports соответствуют слоёвым границам.

## 14. Антипаттерны

**Нельзя:**
- `domain/user.ts` импортирует `PrismaClient`.
- `CreateUserUseCase` принимает `FastifyRequest`.
- `users.routes.ts` выполняет `prisma.user.create()`.
- `orders` импортирует `modules/users/infrastructure/...`.
- В `shared/` создаются огромные общие сервисы со знанием всех модулей.
- Каждая сущность автоматически получает `controller + service + repository`, даже когда нет бизнес-смысла.
- Контейнер DI скрывает реальные зависимости либо используется global mutable singleton.
- Отсутствуют уникальные индексы при инвариантах уникальности.
- Entity/DB model возвращается в HTTP JSON напрямую без явного mapper.
- Выбор микросервисов или event sourcing делается «на будущее» без конкретных требований.

**Можно и нужно:**
- Использовать обычные функции вместо классов для простых use cases.
- Пропускать ненужный слой в примитивных модулях, если границы сохраняются.
- Отделять большие сценарии в vertical slices внутри модуля.
- Подключать Prisma, Drizzle, Kysely или raw SQL как **infrastructure**, не как модель всего приложения.

## 15. Чек-лист готовности production

- [ ] Production repository (PostgreSQL/другая БД), реальные миграции, UNIQUE constraints
- [ ] Задокументированная и валидируемая конфигурация env
- [ ] Структурированные безопасные логи + request/trace IDs
- [ ] Authentication + per-operation authorization
- [ ] Health/liveness/readiness endpoints и graceful shutdown
- [ ] HTTP response schemas, API versioning, OpenAPI при необходимости
- [ ] Tests: domain/application, HTTP, real DB, critical E2E
- [ ] Rate limits, timeouts, maximum body size, CORS/security headers
- [ ] Retry/idempotency/transaction handling для критических операций
- [ ] DB pool lifecycle, monitoring/metrics/tracing, alarms
- [ ] CI: lint, typecheck, test, migration verification, security scans
- [ ] Правила модульных импортов закреплены ESLint/dependency-cruiser либо аналогом

## 16. Инструкция для AI-агента (можно копировать как prompt)

```text
Ты разрабатываешь Fastify + TypeScript backend по стандарту Modular Monolith + Clean Architecture.

СТРОГИЕ ПРАВИЛА:
1. Организуй код по бизнес-модулям в src/modules/<feature>/, не по глобальным technical layers.
2. В каждом модуле используй domain/, application/, infrastructure/, presentation/ по потребности.
3. domain: чистый TypeScript, сущности, value objects, инварианты, без Fastify/ORM/SQL.
4. application: use cases + ports (interfaces), не импортирует Fastify/БД/ORM/Redis SDK.
5. infrastructure: реализации application ports, SQL/ORM, внешние API, маппинг persistence -> domain.
6. presentation: Fastify routes, JSON schemas, HTTP DTO mapping; никакой бизнес-логики и запросов к БД.
7. Соединяй зависимости явно в composition root/module factory через constructor/factory injection.
8. Модули общаются только через публичные APIs/ports/events; никаких deep imports между модулями.
9. Репозитории должны защищать атомарность/уникальность на уровне БД, не посредством read-then-write.
10. Схемы HTTP полностью валидируют вход; domain дополнительно защищает бизнес-инварианты.
11. Возвращай из use cases domain/application данные, не HTTP response/ORM models.
12. Ошибки внутри бизнес-слоев имеют стабильные codes; в HTTP mapping превращаются в безопасные коды/ответы.
13. Выноси config и infrastructure на startup; бизнес-слои не читают process.env.
14. Соблюдай encapsulation Fastify; не используй fastify-plugin для обычных feature modules без причины.
15. Для новой фичи: сначала use case и границы, затем port, adapter, route, tests, wiring.
16. Пиши unit tests для domain/use cases, integration tests для repository и app.inject tests для HTTP.
17. Не добавляй слои/DI-контейнер/event bus/microservices ради шаблона. Предпочитай самый простой подход, совместимый с этими правилами.
18. Показывай дерево новых файлов и кратко объясняй, какие зависимости пересекают границы модулей.

Если требование конфликтует с архитектурой, опиши конфликт и предложи решение, сохраняющее направленность зависимостей.
```

## 17. Как запустить этот пример

Node.js >= 20 и npm:

```bash
npm install
npm run dev
```

В другом терминале:

```bash
curl -i http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/v1/users/ \
  -H 'content-type: application/json' \
  -d '{"email":"ada@example.com","name":"Ada"}'
```

Также доступны:

```bash
npm run typecheck
npm run build
npm test
```

**Ограничение примера:** `InMemoryUserRepository` предназначен только для демонстрации и тестов. Содержимое пропадает при перезапуске, не разделяется между экземплярами сервера и не заменяет реальные миграции/ограничения БД. Проверка установки пакетов и выполнения тестов в среде подготовки шаблона не завершилась; перед использованием необходимо запустить команды выше.
