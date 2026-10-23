import { mkdir, writeFile } from 'node:fs/promises'
import pg from 'pg'

const day = process.argv[2] ?? new Date().toISOString().slice(0, 10)
const limit = Number(process.env.DAILY_BUDGET_RUB ?? 500)
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL не задан: команда читает его из projects/backend/.env')
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Использование: pnpm monitor:report [ГГГГ-ММ-ДД]')

const client = new pg.Client({ connectionString: url })
await client.connect()
const rows = async (sql: string, params: unknown[] = [day]) => (await client.query(sql, params)).rows

const runs = await rows(
  `with ended as (
     select r.*, coalesce(r.input->>'kind', 'refresh_feed') as kind,
            extract(epoch from r.updated_at - r.created_at) as seconds,
            extract(epoch from (select min(e.at) from run_events e where e.run_id = r.id and e.type = 'step.started') - r.created_at) as queue
     from analysis_runs r where r.budget_day = $1
   ), calls as (
     select c.run_id, count(*) as calls, sum(coalesce((c.response->'data'->'response_metadata'->'usage'->>'cost')::numeric, 0)) as cost
     from agent_model_calls c join ended r on r.id = c.run_id group by c.run_id
   )
   select kind, count(*) as total,
          count(*) filter (where status = 'completed') as completed,
          count(*) filter (where status = 'partial') as partial,
          count(*) filter (where status = 'failed') as failed,
          count(*) filter (where status = 'cancelled') as cancelled,
          count(*) filter (where status in ('queued', 'running', 'cancelling')) as active,
          count(*) filter (where attempt > 1) as retried,
          percentile_cont(0.5) within group (order by seconds) filter (where status in ('completed', 'partial')) as p50,
          percentile_cont(0.95) within group (order by seconds) filter (where status in ('completed', 'partial')) as p95,
          percentile_cont(0.5) within group (order by queue) as queue_p50,
          percentile_cont(0.95) within group (order by queue) as queue_p95,
          avg(calls.calls) as calls,
          sum(calls.cost) as cost,
          avg(calls.cost) as cost_per_run
   from ended left join calls on calls.run_id = ended.id
   group by kind order by kind`,
)
const errors = await rows(`select left(coalesce(error, '—'), 120) as error, count(*) as n from analysis_runs where budget_day = $1 and status = 'failed' group by 1 order by 2 desc`)
const budget = (await rows(`select spent, reserved from daily_budgets where day = $1`))[0] ?? { spent: 0, reserved: 0 }
const insights = (
  await rows(
    `select count(*) as total,
            count(*) filter (where i.data->>'status' = 'complete') as complete,
            count(*) filter (where i.data->>'status' = 'insufficient_evidence') as insufficient,
            count(*) filter (where i.data->'bankPosition'->>'status' = 'available') as with_bank,
            count(*) filter (where jsonb_array_length(coalesce(i.data->'risks', '[]')) + jsonb_array_length(coalesce(i.data->'opportunities', '[]')) > 0
                               and jsonb_array_length(coalesce(i.data->'actions', '[]')) > 0) as filled
     from insights i join analysis_runs r on r.id = i.run_id where r.budget_day = $1`,
  )
)[0]
const answers = (
  await rows(
    `select count(*) as total, count(*) filter (where m.text ilike 'Подтверждённых данных для ответа недостаточно%') as empty
     from conversation_messages m join analysis_runs r on r.id = m.run_id where m.author = 'assistant' and r.budget_day = $1`,
  )
)[0]
const feedback = await rows(
  `select i.perspective,
          count(*) filter (where s.feedback->>'rating' = 'useful') as useful,
          count(*) filter (where s.feedback->>'rating' = 'not_useful') as not_useful,
          count(*) filter (where s.saved_at is not null) as saved
   from insight_user_states s join insights i on i.id = s.insight_id group by i.perspective order by i.perspective`,
  [],
)
const comments = await rows(
  `select i.company_id, i.perspective, left(i.data->'event'->>'title', 80) as title, s.feedback->>'comment' as comment
   from insight_user_states s join insights i on i.id = s.insight_id
   where s.feedback->>'rating' = 'not_useful' order by i.company_id`,
  [],
)
await client.end()

const n = (v: unknown) => Number(v ?? 0)
const sec = (v: unknown) => (v === null || v === undefined ? '—' : n(v).toFixed(0))
const rub = (v: unknown) => n(v).toFixed(2)
const pct = (a: unknown, b: unknown) => (n(b) ? `${Math.round((n(a) / n(b)) * 100)}%` : '—')
const cell = (t: unknown) => String(t ?? '').replace(/\|/g, '/').replace(/\n+/g, ' ') || '—'
const kindName: Record<string, string> = { refresh_feed: 'Сводка', question: 'Вопрос' }
const total = runs.reduce((s, r) => s + n(r.total), 0)
const failed = runs.reduce((s, r) => s + n(r.failed), 0)
const spentReal = runs.reduce((s, r) => s + n(r.cost), 0)
const useful = feedback.reduce((s, r) => s + n(r.useful), 0)
const rated = feedback.reduce((s, r) => s + n(r.useful) + n(r.not_useful), 0)

const checks = [
  ['Ошибок запусков ≤ 2%', total ? failed / total <= 0.02 : true],
  ['Сводка p95 ≤ 60 с', n(runs.find((r) => r.kind === 'refresh_feed')?.p95) <= 60],
  ['Очередь p95 ≤ 10 с', runs.every((r) => r.queue_p95 === null || n(r.queue_p95) <= 10)],
  ['Списано за сутки ≤ 70% лимита', n(budget.spent) <= limit * 0.7],
  ['«Полезно» ≥ 70% оценок', rated ? useful / rated >= 0.7 : true],
] as const

const report = [
  `# Мониторинг сервиса — ${day}`,
  '',
  'Отчет `pnpm monitor:report` по журналам Postgres. Цели и процесс — `docs/quality-monitoring.md`. Отчет хранится вне git: в нем комментарии пользователей.',
  '',
  '## Проверки',
  '',
  ...checks.map(([name, ok]) => `- ${ok ? '✅' : '❌'} ${name}`),
  '',
  '## Запуски',
  '',
  '| Тип | Всего | Готово | Частично | Ошибка | Отменено | В работе | Повторы | Время p50 / p95, с | Очередь p50 / p95, с | Вызовов модели | Стоимость, ₽ | ₽ на запуск |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...runs.map(
    (r) =>
      `| ${kindName[r.kind] ?? r.kind} | ${r.total} | ${r.completed} | ${r.partial} | ${r.failed} | ${r.cancelled} | ${r.active} | ${r.retried} | ${sec(r.p50)} / ${sec(r.p95)} | ${sec(r.queue_p50)} / ${sec(r.queue_p95)} | ${n(r.calls).toFixed(1)} | ${rub(r.cost)} | ${rub(r.cost_per_run)} |`,
  ),
  '',
  `Траты: по ответам модели ${rub(spentReal)} ₽; списано из лимита ${rub(budget.spent)} ₽ из ${limit} ₽ (${pct(budget.spent, limit)}), в резерве ${rub(budget.reserved)} ₽. Если шлюз не вернул стоимость, списывается весь резерв запуска, поэтому списано больше фактического.`,
  '',
  ...(errors.length ? ['Ошибки:', '', ...errors.map((e) => `- ${e.n} × ${cell(e.error)}`), ''] : []),
  '## Содержание',
  '',
  '| Метрика | Значение |',
  '| --- | --- |',
  `| Карточек создано | ${n(insights?.total)} |`,
  `| Полных (не «недостаточно данных») | ${pct(insights?.complete, insights?.total)} |`,
  `| С проверенной позицией банка | ${pct(insights?.with_bank, insights?.total)} |`,
  `| С риском или возможностью и шагом | ${pct(insights?.filled, insights?.total)} |`,
  `| Ответов на вопросы | ${n(answers?.total)} |`,
  `| Из них «Подтверждённых данных недостаточно» | ${pct(answers?.empty, answers?.total)} |`,
  '',
  '## Оценки пользователей (за все время)',
  '',
  '| Роль | Полезно | Не полезно | Доля «полезно» | Сохранено |',
  '| --- | --- | --- | --- | --- |',
  ...feedback.map((f) => `| ${f.perspective} | ${f.useful} | ${f.not_useful} | ${pct(f.useful, n(f.useful) + n(f.not_useful))} | ${f.saved} |`),
  '',
  ...(comments.length
    ? ['Карточки с оценкой «не полезно» — для еженедельного разбора:', '', '| Компания | Роль | Событие | Комментарий |', '| --- | --- | --- | --- |', ...comments.map((c) => `| ${c.company_id} | ${c.perspective} | ${cell(c.title)} | ${cell(c.comment)} |`), '']
    : []),
].join('\n')

const outDir = new URL('../data/processed/monitor/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`monitor-${day}.md`, outDir), report)
console.log(checks.map(([name, ok]) => `${ok ? 'ок ' : 'НЕТ'} ${name}`).join('\n'))
console.log(`\nОтчет: data/processed/monitor/monitor-${day}.md`)
