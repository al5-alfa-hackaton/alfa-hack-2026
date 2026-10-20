# Контракты API и интерфейса

## Уже существующие технические маршруты

Fastify слушает `3001`. `GET /health` возвращает `{ "status": "ok", "service": "backend" }`. `GET /ready` возвращает `{ "status": "ok", "database": "not_configured" }` без DATABASE_URL; при заданном URL выполняет `select 1` через Drizzle и отвечает `database: "ok"`, либо HTTP 503 с `database: "unavailable"`. Это готовность каркаса, не реализованного предметного продукта. Неверная конфигурация останавливает запуск.

Frontend:3000 отображает один экран шаблона. Запрос `/api/health` проксируется Nitro в `/health` в dev и сборке; адрес backend задается при dev-запуске/сборке. Остальные маршруты ниже **не реализованы**.

## Будущий REST API v1

| Метод / путь | Назначение |
| --- | --- |
| `GET /v1/me` | Текущий пользователь, роли, разрешенные компании |
| `GET /v1/companies` | Доступные пользователю компании |
| `GET /v1/companies/:id/context` | Признаки, provenance, неизвестные значения |
| `GET /v1/companies/:id/insights` | Персональная лента, cursor pagination, фильтры |
| `POST /v1/analysis-runs` | Новый анализ; Idempotency-Key; HTTP 202 с runId/statusUrl |
| `GET /v1/analysis-runs/:id` | Статус, прогресс, результат/ошибка |
| `GET /v1/analysis-runs/:id/events` | SSE c event ID и восстановлением после разрыва |
| `POST /v1/analysis-runs/:id/cancel` | Запрос отмены, идемпотентная операция |
| `GET /v1/insights/:id` | Полный результат с цитатами и признаками |
| `GET /v1/documents/:id` | Разрешенный первоисточник/фрагмент |
| `POST /v1/insights/:id/questions` | Уточняющий вопрос; новый связанный run, HTTP 202 |
| `POST /v1/insights/:id/feedback` | Полезность/ошибка с привязкой к версии |

Каждый endpoint проверяет company/user scope. Query role не дает новых прав. Cross-tenant ID не раскрывают наличие чужого ресурса. Входы валидируются Zod/JSON Schema, ошибки имеют форму `{ code, message, requestId, details? }` без stack/secrets. Нужны 400/401/403/404/409/429/503 с определенными контрактами; budget exhaustion отделяется от provider unavailable.

Параметры запуска: `companyId`, `role`, `timeRange`, необязательный `eventId`/вопрос. Backend сам определяет scope, профиль и источники; не принимает произвольный prompt, executable, provider URL или shell command от браузера.

## Проект результата

```ts
type Insight = {
  id: string
  schemaVersion: '1'
  companyId: string
  profileVersion: string
  runId: string
  generatedAt: string // ISO 8601 with timezone
  status: 'complete' | 'partial' | 'insufficient_evidence'
  event: { title: string; happenedAt?: string; factClaimIds: string[] }
  relevance: { score: number; reasons: { featureId: string; explanation: string }[] }
  claims: {
    id: string
    kind: 'fact' | 'bank_position' | 'ai_inference'
    text: string
    evidenceIds: string[]
    companyFeatureIds: string[]
    uncertainty?: string
  }[]
  risks: { claimIds: string[]; horizon?: string }[]
  opportunities: { claimIds: string[]; horizon?: string }[]
  possibleActions: { text: string; basedOnClaimIds: string[] }[]
  evidence: {
    id: string
    documentId: string
    sourceKind: 'news' | 'bank'
    quote: string
    locator: { page?: number; start?: number; end?: number }
    publishedAt?: string
  }[]
  missingData: string[]
  limitations: string[]
}
```

Это проект контракта, не готовая TypeScript/DB-схема. В реализации нужны runtime constraints: relevance 0..1; `bank_position` ссылается только на bank evidence; каждый evidence ID существует; цитата принадлежит разрешенному документу; выводы без достаточной опоры маркируются и не публикуются как факт. Оценка релевантности не равна вероятности истинности.

SSE типы: `run.queued`, `step.started`, `step.completed`, `run.progress`, `run.completed`, `run.partial`, `run.failed`, `run.cancelled`; полезная нагрузка ограничена UI-прогрессом и публичными evidence summaries. Не передавать raw reasoning, токены провайдера или приватные tool payloads.

## Будущие экраны

- Входная точка сервиса и выбор компании/роли.
- Контекст компании с источниками признаков и предупреждениями о пропусках.
- Ранжированная лента; объяснение «почему для вас», период, отрасль/тематика.
- Детальный инсайт: факт → связь с компанией → риски/возможности → возможные действия; отдельные области «Позиция банка» и «AI-интерпретация».
- Источники с цитатами, временем и переходом к оригиналу; обратная связь.
- Вопросы и уточнения в сохраненном контексте; статус анализа и отмена.

Для всех экранов предусмотреть loading, empty, partial, error, stale, budget exhausted и access denied; работа с клавиатуры, контраст, reduced motion, корректные aria labels. Полный набор shadcn/ui импортирован в исходники как строительные блоки, но не должен целиком грузиться в стартовый bundle: импортировать отдельные используемые компоненты.
