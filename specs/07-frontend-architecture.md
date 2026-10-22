# Frontend: упрощенная архитектура по rules.md

Основа — [исходные правила пользователя](source/frontend-rules.md). Не вводим дополнительные FSD-слои features/widgets и не раскладываем каждый маленький компонент в пять пустых папок.

```text
src/
  app/                router, routes, providers, styles
  pages/              feed, company, history, ui-kit
  blocks/             workspace-shell, context-switcher, news-feed,
                      analysis-control, insight-reader
  components/         ui (61 shadcn-примитив), brand, page-heading, empty-state
  entities/           company, insight, analysis, workspace
  shared/             lib, hooks
```

## Зависимости

`app → pages → blocks → components → entities → shared`. Нижний слой не импортирует верхний. Страницы не импортируют другие страницы. Между blocks/entities допускается практичный cross-import без runtime-цикла. Импорты многосоставного чужого модуля идут через его index.ts.

- **app:** TanStack routing, providers и общие стили. Маршруты только связывают URL со страницами. `__root.tsx` — обязательное имя TanStack; `route-tree.gen.ts` — generated file. Эти framework conventions — исключения из обычного kebab-case, не повод менять generator вручную.
- **pages:** композиция экрана, параметры маршрута, поиск/фильтры и экспорт текущего списка. `/` и `/saved` используют одну FeedPage с prop, а не импорт одной страницы из другой.
- **blocks:** законченные сценарии с бизнес-данными. Reader содержит внутренние sources/conversation/feedback modules; analysis-control — запуск/отмена/сценарии. Workspace shell работает с session и company context.
- **components:** только props и отображение. Generic EmptyState составляет shadcn Empty, PageHeading — типографику; они не читают workspace store и не выполняют предметные запросы. Локальные ui-примитивы — самостоятельные single-file modules, импортируются по стандартному shadcn path, а не через общий barrel из 61 компонента.
- **entities:** типы и данные company/insight/run/session, ranking/answer fixture transformations, schema persisted state. WorkspaceProvider подключается из app; его контекст не требует imports app из blocks.
- **shared:** abortable delay, cn, useIsMobile. Бизнес-сущностей здесь нет.

Скрипт `scripts/check-architecture.mjs` проверяет все source imports, направление слоев, публичные API, запрет page-to-page и runtime-циклы. Type-only ссылка generated route tree обратно на router разрешена: исполняемого цикла не создает. `pnpm typecheck` включает этот check. Для архитектурных правил, выраженных произвольными dynamic imports, нужны дополнительные проверки при их появлении.

## UI-система

Готовые shadcn-компоненты управляют focus/keyboard/modal lifecycle: Sidebar, DropdownMenu, ToggleGroup, Sheet, Tabs, Accordion, Table, Empty, Alert, Progress, Dialog, Textarea, Tooltip и Sonner. Не пишем собственные select/menu/drawer/toast и focus trap. Иконки — Lucide, шрифт — self-hosted Manrope с кириллицей.

Стиль: нейтральная рамка и рабочее полотно, компактные строки, основной красный акцент Альфы, семантические точки риска/возможности. Нет KPI-плиток, фиолетовых панелей, эффектных баннеров и входного маркетингового шага. Контекст компании и «почему для вас» важнее декора.

## Состояние и навигация

- Маршруты `/`, `/saved`, `/company`, `/history`, `/ui-kit` — реальные TanStack routes: back/reload работают.
- Reader открыт через `?insight=rate`; deep link и reload сохраняют выбранное событие. При закрытии фокус возвращается к строке.
- Поиск/фильтр — состояние страницы, сбрасывается при смене компании/роли. Ctrl/Cmd+K фокусирует поиск, не перехватывается открытым reader.
- Компания/роль, saved, chats, ratings, remarks и history — `alfa-demo-v1` в localStorage, с Zod-валидацией. Повреждение/отказ хранилища явно отображаются. Новое поле remarks мигрируется default-значением; оценка и замечание больше не перетирают друг друга.
- Scope всех взаимодействий: company + role + insight. Смена контекста закрывает reader и отменяет незавершенное демодействие. История записывается под исходным scope.
- Отмена/уход со страницы прерывает демо-run через AbortController; это поведение mock adapter, не проектирование production worker. В live фоновый run продолжает работу независимо от вкладки; отмена явная через API.
- Theme preference обслуживает next-themes. `useEffect` загружает browser session после SSR; до этого Skeleton, без hydration mismatch.

## Как заменять mock на backend

1. В shared добавить единый HTTP transport: same-origin `/api/v1`, AbortSignal, safe ApiError, credentials и CSRF policy при cookie-auth. Не класть туда company/insight-логику.
2. В entities добавить DTO schemas/adapters и entity API через публичные index.ts; неизвестные числа не подменять fixtures. Из текущего `company/context` выделить server DTO, убрать допущение только двух CompanyId.
3. В blocks заменить rankedNews/сценарные answers на entity queries/mutations. Рекомендуется TanStack Query с ключом `(user, companyId, perspective, resource, version, filters)`; сейчас server cache не нужен и не установлен.
4. Мутации saved/feedback — optimistic UI с rollback. Pending question связывается с run/conversation IDs; reconnect не дублирует сообщение.
5. Snapshot ленты и новый run раздельны. Progress читает SSE, при обрыве восстанавливает sequence или polling; new insight публикуется только после terminal event.
6. В live provider не сериализует server data в demo localStorage; logout очищает пользовательский cache. Demo и live adapters переключаются явно, без fallback на synthetic fixtures при сетевой ошибке.
7. Сначала contract tests Fastify/worker, затем E2E с реальным API. Список ручек и mapping экраны→DTO — [05-api-and-ui.md](05-api-and-ui.md).
