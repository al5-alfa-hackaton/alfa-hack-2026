# Frontend: архитектура рабочего пространства

Основа — [правила пользователя](source/frontend-rules.md). Актуальное поведение и авторизация: [12-product-workspace.md](12-product-workspace.md).

```text
src/
  app/          TanStack routing, providers, styles
  pages/        feed, company, history, ui-kit
  blocks/       workspace-shell, context-switcher, news-feed,
                analysis-control, insight-reader
  components/   61 shadcn-примитив, generic empty/loading/error, heading, brand
  entities/     company, insight, analysis, workspace
  shared/       typed transport, query client, cn, useIsMobile
```

## Зависимости

`app → pages → blocks → components → entities → shared`. Нижний слой не импортирует верхний; страницы не импортируют другие страницы. Между blocks/entities разрешены практичные cross-imports через публичные index.ts без runtime-цикла. Generic components работают только через props. UI-примитивы импортируются стандартными single-file shadcn paths.

Скрипт check-architecture проверяет imports и циклы при typecheck. Framework-generated route tree имеет стандартные соглашения TanStack, включая __root.tsx.

## Состояние

TanStack Query управляет API-данными, AbortSignal, ошибками, invalidation и polling. DTO выводятся из generated OpenAPI operations; UI не дублирует серверную схему. WorkspaceProvider читает /me, разрешённые компании и контекст. Выход/новый вход очищают cache, 401 инициирует проверку сессии. Ошибка API не переключает данные на fixtures.

В sessionStorage остаются только company/perspective, отдельно для user ID. Они валидируются против серверного каталога; запрет browser storage не блокирует работу. Сохранения, оценки, замечания, сообщения и история находятся в PostgreSQL. Browser не сохраняет bearer key. Theme preference обслуживает next-themes.

Ключи запросов включают ресурс, компанию/insight и perspective; user boundary обеспечивается очисткой всего QueryClient при смене сессии. Каждый SSR document создаёт отдельный QueryClient, без общего процесса cache между пользователями. Предметные запросы начинаются на клиенте; SSR отображает одинаковое loading state без personal data.

## Сценарии

- / и /saved используют общую FeedPage; /company показывает серверные features/gaps; /history — SQL runs. /ui-kit доступен в dev и убран из рабочей навигации.
- Reader открывается по ?insight=UUID и независимо запрашивает detail: старые сохранённые версии не обязаны входить в текущую сводку. Компания дополнительно сверяется с активным контекстом. Escape возвращает фокус к строке.
- Поиск/фильтр сбрасываются при смене контекста. TXT содержит только текущие отфильтрованные загруженные события; saved поддерживает пагинацию.
- Start/question mutations передают Idempotency-Key и сохраняют его для повтора запроса с неизвестным исходом. Активные задания восстанавливаются по серверной истории; polling в работе 1 с, в простое 15 с. Уход со страницы не отменяет worker.
- Предыдущая сводка сохраняется при pending/ошибке. Проценты прогресса не выдумываются. Отмена — POST cancel; её результат остаётся в SQL истории.
- Save/feedback не объявляются успешными до ответа API; pending блокирует повтор. Rating и comment отправляются независимо с сохранением второго значения, version предотвращает запись в другой разбор.
- Документы и изображения запрашиваются только через authorized API, внешние ссылки — HTTPS. Факты, AI inference и bank position различаются; неизвестные данные и ограничения не заменяются общими советами.
- Авторизация без SSO: логин/пароль обмениваются на HttpOnly cookie; регистрация в два шага создаёт пользователя с новой компанией. Формы используют React Hook Form, права и профили — PostgreSQL. [Подробности](13-accounts-and-packages.md). CORS/Origin/TTL/Secure описаны в спецификации 12.

## UI

Sidebar, DropdownMenu, ToggleGroup, Sheet, Tabs, Accordion, Table, Empty, Alert, Dialog, Textarea, Tooltip и Sonner — готовые компоненты shadcn/Radix. Нет самодельных focus traps, menu/select/toast или искусственного прогресса. Manrope с кириллицей хранится локально. Нейтральное рабочее полотно, красный основной акцент, компактные списки событий и объяснения их значимости.

Playwright использует изолированный fixture backend, проверяет вход, SQL persistence, scopes, диалоги, источники, ошибки, responsive layout и axe. Снимки README делаются отдельно с реальными загруженными данными; отсутствие настроенного LLM отражается в интерфейсе.
