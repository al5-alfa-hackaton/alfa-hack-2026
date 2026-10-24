import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { expertGrade, expertRoles, type ExpertLabels } from '../eval/labels.js'
import { dataPaths, loadConfig } from '../config.js'
import { buildDataContext, loadDataContext, type DataContext } from '../data/context.js'
import { irrelevantAtK, mean, ndcgAtK, precisionAtK, recallAtK, roleGrades, unjudged, type Grades } from '../eval/metrics.js'
import { ML_RANKING_VERSION, rankNewsForCompany, sameEvent, type Perspective } from '../news/ranking.js'
import { loadNewsTags } from '../news/tagging.js'

type RankingSet = {
  asOf: string
  purpose: string
  labeledBy: string
  baseline: { version: string; description: string }
  roles: Record<string, string[]>
  companies: { id: string; industry: string; labels: Grades; baselineTop: Record<Perspective, string[]> }[]
}

const SETS = [
  { file: 'ranking-set.json', name: 'Настройка' },
  { file: 'ranking-holdout.json', name: 'Настройка: бывшая отложенная №1' },
  { file: 'ranking-holdout-2.json', name: 'Отложенная проверка №2' },
]
const PERSPECTIVES: Perspective[] = ['cfo', 'ceo']
const SYSTEMS = ['Правила', 'ML']
const config = loadConfig()
const ctx = await loadDataContext(config)
const corpora = new Map<string, DataContext>()
const corpusAt = (asOf: string) => {
  let at = corpora.get(asOf)
  if (!at) corpora.set(asOf, (at = buildDataContext(ctx.companies, ctx.bank, ctx.news.filter((n) => n.fetchedAt <= asOf))))
  return at
}
const tags = await loadNewsTags(dataPaths(config).newsTags)

type Row = { system: string; companyId: string; perspective: Perspective; list: string[]; labels: Grades }
type Metrics = ReturnType<typeof metricsOf>

const byId = new Map(ctx.news.map((n) => [n.id, n]))

function withoutRepeats(row: Row): Row {
  const labels = { ...row.labels }
  const list = row.list.map((id, i) => {
    const news = byId.get(id)
    const repeat = news && row.list.slice(0, i).some((prev) => byId.has(prev) && sameEvent(byId.get(prev)!, news))
    if (!repeat) return id
    labels[`repeat:${id}`] = 0
    return `repeat:${id}`
  })
  return { ...row, list, labels }
}

function metricsOf(row: Row, rows: Row[]) {
  const others = new Set(rows.filter((r) => r.system === row.system && r.perspective === row.perspective && r.companyId !== row.companyId).flatMap((r) => r.list.slice(0, 3)))
  const top3 = row.list.slice(0, 3)
  return {
    p3: precisionAtK(row.list, row.labels, 3),
    strict3: precisionAtK(row.list, row.labels, 3, 2),
    r5: recallAtK(row.list, row.labels, 5),
    ndcg5: ndcgAtK(row.list, row.labels, 5),
    junk3: irrelevantAtK(row.list, row.labels, 3),
    shared3: top3.filter((id) => others.has(id)).length / Math.max(1, top3.length),
    unjudged: unjudged(row.list, row.labels, 5).length,
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const line = (label: string, ms: Metrics[]) => {
  const avg = (f: (m: Metrics) => number) => mean(ms.map(f))
  return `| ${label} | ${pct(avg((m) => m.p3))} | ${pct(avg((m) => m.strict3))} | ${pct(avg((m) => m.r5))} | ${avg((m) => m.ndcg5).toFixed(2)} | ${pct(avg((m) => m.junk3))} | ${pct(avg((m) => m.shared3))} | ${ms.reduce((s, m) => s + m.unjudged, 0)} |`
}
const header = [
  '| Отбор | P@3 | P@3 строгая | R@5 | nDCG@5 | Нерелевантных в топ-3 | Топ-3 совпадает с другими компаниями | Не размечено в топ-5 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
]
const title = (id: string) => ctx.news.find((n) => n.id === id)?.title.slice(0, 80).replace(/\|/g, '/') ?? id

const expertPath = new URL('../../eval/expert-labels.json', import.meta.url)
const experts: ExpertLabels = existsSync(expertPath) ? JSON.parse(await readFile(expertPath, 'utf8')) : { pairs: {} }

const sections: string[] = []
const console_: string[] = []
for (const { file, name } of SETS) {
  const set = JSON.parse(await readFile(new URL(`../../eval/${file}`, import.meta.url), 'utf8')) as RankingSet
  let byPeople = 0
  for (const c of set.companies)
    for (const newsId of Object.keys(c.labels)) {
      const pair = experts.pairs[`${c.id}|${newsId}`]
      const grade = expertGrade(pair)
      if (grade === undefined) continue
      c.labels[newsId] = grade
      set.roles[newsId] = expertRoles(pair) ?? set.roles[newsId] ?? ['ceo']
      byPeople++
    }
  const rows: Row[] = set.companies.flatMap((c) =>
    PERSPECTIVES.flatMap((perspective) => {
      const labels = roleGrades(c.labels, set.roles, perspective)
      return [
        { system: 'Правила', companyId: c.id, perspective, labels, list: c.baselineTop[perspective] },
        {
          system: 'ML',
          companyId: c.id,
          perspective,
          labels,
          list: rankNewsForCompany(corpusAt(set.asOf), tags, c.id, { perspective, asOf: set.asOf, limit: 5 }).map((r) => r.news.id),
        },
      ]
    }),
  )
  const scored = rows.map(withoutRepeats)
  const metrics = new Map(rows.map((r, i) => [r, metricsOf(scored[i]!, scored)]))
  const pick = (f: (r: Row) => boolean) => rows.filter(f).map((r) => metrics.get(r)!)
  const summary = SYSTEMS.map((s) => line(s, pick((r) => r.system === s)))
  const byRole = SYSTEMS.flatMap((s) => PERSPECTIVES.map((p) => line(`${s}, ${p}`, pick((r) => r.system === s && r.perspective === p))))
  const ceiling = mean(rows.filter((r) => r.system === 'ML').map((r) => Math.min(3, Object.values(r.labels).filter((g) => g >= 1).length) / 3))
  console_.push(`${name} (потолок P@3 ${pct(ceiling)}):`, ...summary)
  sections.push(
    `## ${name}`,
    '',
    `Файл \`eval/${file}\`: ${set.purpose}. ${set.companies.length} компаний, ${set.companies.reduce((s, c) => s + Object.keys(c.labels).length, 0)} пар «компания — новость», дата анализа ${set.asOf}.`,
    `Отрасли: ${set.companies.map((c) => `${c.id} — ${c.industry}`).join('; ')}.`,
    `Оценки людей (\`eval/expert-labels.json\`, медиана разметчиков): ${byPeople} пар из ${set.companies.reduce((s, c) => s + Object.keys(c.labels).length, 0)}, остальные — оценки ассистента.`,
    `Потолок P@3 — ${pct(ceiling)}: столько дал бы идеальный отбор, если в пуле меньше трех связанных новостей для компании и роли.`,
    '',
    ...header,
    ...summary,
    '',
    'По ролям:',
    '',
    ...header,
    ...byRole,
    '',
    ...set.companies.flatMap((c) => [
      `### ${c.id} — ${c.industry}`,
      '',
      ...PERSPECTIVES.flatMap((perspective) =>
        SYSTEMS.flatMap((system) => {
          const row = rows.find((r) => r.system === system && r.companyId === c.id && r.perspective === perspective)!
          const m = metrics.get(row)!
          return [
            `**${system}, ${perspective}** — P@3 ${pct(m.p3)}, R@5 ${pct(m.r5)}, nDCG@5 ${m.ndcg5.toFixed(2)}`,
            '',
            ...scored[rows.indexOf(row)]!.list.map((id, i) => `${i + 1}. [${id.startsWith('repeat:') ? 'повтор' : (row.labels[id] ?? '?')}] ${title(id.replace('repeat:', ''))}`),
            '',
          ]
        }),
      ),
    ]),
  )
}

const date = new Date().toISOString().slice(0, 10)
const report = [
  `# Оценка отбора событий — ${date}`,
  '',
  `Сравниваются правила по словам (базовый метод бэкенда, топ-5 зафиксирован в наборе) и ML-отбор (${ML_RANKING_VERSION}), топ-5 для ракурсов cfo и ceo.`,
  'Оценки: 2 — прямо влияет на деньги компании, 1 — косвенно, 0 — не связано. Для каждой новости отмечено, какому руководителю она важна напрямую; для другой роли оценка снижается на 1.',
  'Разметку сделал ассистент по профилю компании и тексту новости; ее нужно выборочно проверить экспертом.',
  '',
  '- **P@3** — доля связанных с компанией новостей среди трех, которые увидит пользователь; строгая — только прямо влияющих.',
  '- **R@5** — доля всех связанных новостей пула, попавших в топ-5. Пул собран из выдачи обоих отборов, поэтому это полнота относительно пула, а не всего корпуса.',
  '- **nDCG@5** — учитывает порядок: прямые новости должны стоять выше косвенных.',
  '- **Нерелевантных в топ-3** — то, что пользователь назовет мусором.',
  '- **Совпадение с другими компаниями** — доля топ-3, которая попала и в топ-3 других компаний того же ракурса; высокая — отбор не персонализирован. Не зависит от разметки.',
  '- **Не размечено** — новости вне пула разметки, считаются нерелевантными. После изменения отбора пул нужно доразметить.',
  '- **Повтор** — новость о том же событии, что и новость выше в списке (другой источник, похожий заголовок, разница до 2 дней). Пользователю она ничего не добавляет, поэтому считается нерелевантной у обоих отборов.',
  '',
  '**Отложенная проверка №2** — компании и отрасли, которые не использовались ни при подборе весов, ни при сравнении вариантов. Если на ней метрики заметно ниже, чем на настройке, отбор подогнан под примеры. Отложенную №1 смотрели при сравнении вариантов 23.10, поэтому она перенесена в настройку. Корпус новостей покрывает в основном 19–23 октября, поэтому отложить можно только компании, а не период.',
  '',
  ...sections,
].join('\n')

const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`eval-ranking-${date}.md`, outDir), report)
console.log(console_.join('\n'))
console.log(`\nОтчет: results/eval-ranking-${date}.md`)
