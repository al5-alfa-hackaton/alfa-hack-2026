# Ранжирование и восстановление LangGraph

Реализовано 22 октября 2026. Дополняет [backend](10-backend-implementation.md); прежние ограничения про score=0 и отсутствие graph checkpoints сняты.

## Ранжирование

Алгоритм `rules-2026-10-22.1` — чистая функция в analytics/domain. Вход: новости, известные признаки компании, perspective, время создания run и optional timeRange. Это объяснимая эвристика отбора, не обученная вероятность денежного эффекта.

1. Исключить события старше 90 дней, более чем на 5 минут из будущего и вне запрошенного периода. В периоде обязательна известная дата. Новости без даты вне фильтра периода допустимы с малым freshness.
2. Найти подтвержденные каналы связи: собственная отрасль, отрасли группы, наблюдаемые отрасли поставщиков/покупателей, банковские продукты, страны ВЭД, регион и зарплатный проект. Неизвестный/false product не создает экспозицию. Counterparty industries включаются только при `industriesReliable=true`; платежи не считаются всем оборотом компании. Совпадение собственной отрасли повторно не усиливается той же отраслью группы/контрагентов.
3. Рассчитать score:

```text
score = 0.60 × companyFit + 0.20 × perspectiveFit
      + 0.15 × freshness + 0.05 × sourceQuality
freshness = exp(-ageDays / 14)
```

`companyFit` — сумма ограниченных единицей вкладов: собственная отрасль 0.65, группа 0.20, поставщики/покупатели по 0.18; кредиты 0.55, другие финансовые продукты по 0.30; ВЭД 0.40; регион 0.25; payroll 0.30. `perspectiveFit`: CFO предпочитает финансовые события, CEO — спрос/операции/поставки; matched=1, other=0.35. `sourceQuality`: известный официальный source ID=1, прочие=0.65. Freshness/source quality без companyFit не делают событие релевантным. Словарь финансовых терминов различает ставку и поставки.

Сортировка: score по убыванию, затем дата и ID; дубликаты ID устраняются детерминированно. Публикуются `score`, `rank`, `reasons` (feature IDs), `version`, `components`, `explanations` (featureId/signal/weight). Новые поля optional в HTTP-контракте для чтения старых сохраненных версий. OpenAPI и generated frontend types обновлены.

По умолчанию `RANKING_LIMIT=3`, максимум 5. Один graph анализирует выбранный batch, один structured finalizer возвращает `events[]`; число LLM-запросов не умножается на число событий. Каждый опубликованный event обязан иметь проверенную фактическую цитату именно из своей новости. Ответ модели не может поменять порядок ранжирования или прикрепить чужую цитату к событию. После отбрасывания невалидных событий rank перенумеровывается. Batch token usage прикреплен к первому insight, чтобы его не суммировали повторно для каждого события.

Основная лента показывает номер приоритета и основания отбора; reader раскрывает score, признаки и объяснения. Смена CFO/CEO и компании читает отдельный серверный scope. Browser fixture-модель удалена; [актуальный продукт](12-product-workspace.md).

Ограничения: отраслевые правила покрывают восемь групп; словарь и веса требуют экспертного holdout на реальном корпусе. Это не калиброванная ML relevance-модель. Страны ВЭД не говорят о направлении торговли/валюте. Банковская позиция и причинное влияние проходят отдельную проверку и не выводятся из score.

## Checkpoints

Используется штатный `@langchain/langgraph-checkpoint-postgres` / `PostgresSaver`, а не сохранение только итогового JSON. Native migrations создают приватную SQL schema `agent_checkpoints`: checkpoints, blobs, pending writes и migrations. `pnpm db:migrate` сначала выполняет Drizzle migration, затем native checkpoint setup под advisory lock. DDL не выполняется при каждом HTTP-запросе.

Graph сохраняет messages, steps, toolCalls, stopReason, executionScope и structured finalization. `thread_id=runId`; worker выбирает его сам. Durability=sync: следующий шаг запускается после фиксации checkpoint. Продолжение выполняется через `graph.invoke(null, config)`, завершенные tools/steps/finalizer повторно не исполняются. Незавершенный read-only tool node может быть безопасно выполнен заново; инструменты записи сюда добавлять нельзя без собственной идемпотентности.

Execution scope привязан к user/company/perspective/run, profile/corpus versions, prompt/ranking version, модели, лимитам и выбранным событиям. На restart проверяются membership/CLIENT и scope. При изменении корпуса/профиля/модели запуск завершается `execution_context_changed`, вместо смешивания версий. Старые corpus snapshots автоматически не архивируются: для продолжения нужна та же версия входных данных.

Checkpoints содержат внутренний контекст и сообщения. Публичных ручек для их выгрузки/произвольного thread_id нет; REST/SSE/trace не отдают эти данные. Retention и доступ к БД должны учитывать содержимое checkpoints и model response journal; автоматическое удаление пока не добавлено.

## Lease, очередь и публикация

Каждый claim получает случайную lease token и увеличивает attempt. Heartbeat, progress и finish проверяют token; истекшая/чужая lease не позволяет опубликовать результат. Native saver использует обертку pg Pool: при BEGIN в той же SQL-транзакции берется row lock run и проверяется lease, затем записываются checkpoint/blobs/pending writes. Старый worker после takeover не может переписать состояние графа.

Watchdog после истечения lease (45 секунд) возвращает безопасный run в queued и создает новую delivery generation outbox. BullMQ job ID включает runId и generation. По умолчанию `RUN_MAX_RECOVERIES=2`, разрешено 0–3. После исчерпания — `recovery_limit`. Дополнительно dispatcher сверяет опубликованные, но оставшиеся queued SQL-запуски с Redis: потерянные/ошибочно завершенные доставки восстанавливаются. Active jobs не удаляются.

Budget reservation сохраняется между попытками и расходуется один раз при terminal state. Отмена до первого claim освобождает резерв; отмена уже начатого run, в том числе в очереди восстановления, консервативно списывает резерв. При переходе в новый московский бюджетный день дальнейшие запросы не отправляются (`budget_window_expired`). Старые running-запуски, созданные до checkpoint runtime, автоматически заново не исполняются (`legacy_run_without_checkpoint`).

Результаты и terminal event публикуются прежней единственной SQL-транзакцией; crash после commit не создает второй snapshot или второй assistant message. SSE поддерживает `run.resuming` с тем же runId и продолжающимся sequence; polling остается допустимым.

## Сохраненные ответы и граница платного вызова

Drizzle migration добавляет `agent_model_calls`: уникальный `(runId, callKey)`, request hash, response и timestamps. Ключи — agent:step, limit и structure.

- До HTTP-вызова атомарно записывается call intent и проверяется общий лимит `maxSteps+2`.
- Ответ сохраняется до следующего graph checkpoint. Если worker упал между этими записями, новый worker получает сохраненный ответ без второго платного запроса.
- При наличии intent без response неизвестно, успел ли gateway выполнить запрос. Автоматического повторения нет: `model_call_uncertain`; резерв считается расходом.
- Смена request hash приводит к `execution_context_changed`, повтор с другим prompt не маскируется cache hit.

Это не обещание exactly-once HTTP у внешнего провайдера. Без provider idempotency/reconciliation неизвестный исход нельзя безопасно повторить. Сохраняется прежний подтвержденный оператором hard gateway request cap и запрет скрытых model retries.

## Проверки и обновление окружения

```sh
pnpm install --frozen-lockfile
pnpm --filter @alfa/research-agent build
pnpm db:migrate
# После остановки старых worker-процессов:
pnpm worker
pnpm dev
```

При обновлении сначала остановить старые workers, применить миграции и запустить новую версию. API и worker используют один corpus/config. Новые параметры документированы в `.env.example`.

```sh
pnpm typecheck
pnpm test
RUN_INTEGRATION=true TEST_DATABASE_URL=postgresql://alfa:alfa_local_only@127.0.0.1:5432/alfa pnpm test:integration
TEST_BACKEND=true PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm --filter @alfa/frontend test:e2e
pnpm build
pnpm contracts:check
```

Тесты проверяют company/perspective ranking, неизвестные признаки, даты, ties/duplicates, основания score, batch publication; PostgreSQL checkpoints и pending state, повторное открытие графа, сохраненную финализацию, ответ до checkpoint, старую lease, несовпавший scope, неоднозначный paid call, восстановление delivery и сохранение бюджета. Отдельный тест проходит через реальный backend LangGraph/OpenAI adapter с локальным gateway, имитирует crash до SQL publication и подтверждает отсутствие дополнительных provider requests. Платные внешние вызовы не выполняются.
