import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { irrelevantAtK, mean, ndcgAtK, precisionAtK, unjudged, type Grades } from '../eval/metrics.js'
import { ML_RANKING_VERSION, rankNewsForCompany, type Perspective } from '../news/ranking.js'
import { loadNewsTags } from '../news/tagging.js'

type RankingSet = {
  asOf: string
  labeledBy: string
  baseline: { version: string; description: string }
  companies: { id: string; industry: string; labels: Grades; baselineTop: Record<Perspective, string[]> }[]
}

const PERSPECTIVES: Perspective[] = ['cfo', 'ceo']
const set = JSON.parse(await readFile(new URL('../../eval/ranking-set.json', import.meta.url), 'utf8')) as RankingSet
const config = loadConfig()
const ctx = await loadDataContext(config)
const tags = await loadNewsTags(dataPaths(config).newsTags)

type Row = { system: string; companyId: string; perspective: Perspective; list: string[] }
const rows: Row[] = set.companies.flatMap((c) =>
  PERSPECTIVES.flatMap((perspective) => [
    { system: 'Правила', companyId: c.id, perspective, list: c.baselineTop[perspective] },
    {
      system: 'ML',
      companyId: c.id,
      perspective,
      list: rankNewsForCompany(ctx, tags, c.id, { perspective, asOf: set.asOf, limit: 5 }).map((r) => r.news.id),
    },
  ]),
)

const labelsOf = (companyId: string) => set.companies.find((c) => c.id === companyId)!.labels
const shared = (row: Row) => {
  const others = new Set(rows.filter((r) => r.system === row.system && r.perspective === row.perspective && r.companyId !== row.companyId).flatMap((r) => r.list.slice(0, 3)))
  return row.list.slice(0, 3).filter((id) => others.has(id)).length / Math.max(1, row.list.slice(0, 3).length)
}
const metrics = (row: Row) => {
  const labels = labelsOf(row.companyId)
  return {
    p3: precisionAtK(row.list, labels, 3),
    strict3: precisionAtK(row.list, labels, 3, 2),
    ndcg5: ndcgAtK(row.list, labels, 5),
    junk3: irrelevantAtK(row.list, labels, 3),
    shared3: shared(row),
    unjudged: unjudged(row.list, labels, 5).length,
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`
const systems = ['Правила', 'ML']
const summary = systems.map((system) => {
  const own = rows.filter((r) => r.system === system).map(metrics)
  const avg = (f: (m: ReturnType<typeof metrics>) => number) => mean(own.map(f))
  return `| ${system} | ${pct(avg((m) => m.p3))} | ${pct(avg((m) => m.strict3))} | ${avg((m) => m.ndcg5).toFixed(2)} | ${pct(avg((m) => m.junk3))} | ${pct(avg((m) => m.shared3))} | ${own.reduce((s, m) => s + m.unjudged, 0)} |`
})

const title = (id: string) => ctx.news.find((n) => n.id === id)?.title.slice(0, 80).replace(/\|/g, '/') ?? id
const details = set.companies.flatMap((c) => [
  `### ${c.id} — ${c.industry}`,
  '',
  ...PERSPECTIVES.flatMap((perspective) =>
    systems.flatMap((system) => {
      const row = rows.find((r) => r.system === system && r.companyId === c.id && r.perspective === perspective)!
      const m = metrics(row)
      return [
        `**${system}, ${perspective}** — P@3 ${pct(m.p3)}, nDCG@5 ${m.ndcg5.toFixed(2)}`,
        '',
        ...row.list.map((id, i) => `${i + 1}. [${c.labels[id] ?? '?'}] ${title(id)}`),
        '',
      ]
    }),
  ),
])

const date = new Date().toISOString().slice(0, 10)
const report = [
  `# Оценка отбора событий — ${date}`,
  '',
  `Набор: \`eval/ranking-set.json\`, ${set.companies.length} компаний, ${set.companies.reduce((s, c) => s + Object.keys(c.labels).length, 0)} пар «компания — новость», дата анализа ${set.asOf}.`,
  `Разметка: ${set.labeledBy}. Шкала: 2 — прямо влияет на деньги компании, 1 — косвенно, 0 — не связано.`,
  `Сравниваются: правила по словам (${set.baseline.version}, ${set.baseline.description}) и ML-отбор (${ML_RANKING_VERSION}), топ-5 для ракурсов cfo и ceo.`,
  '',
  '## Итого',
  '',
  '| Отбор | P@3 (оценка ≥1) | P@3 строгая (оценка 2) | nDCG@5 | Нерелевантных в топ-3 | Топ-3 совпадает с другими компаниями | Не размечено в топ-5 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...summary,
  '',
  '- **P@3** — доля связанных с компанией новостей среди трех, которые увидит пользователь.',
  '- **nDCG@5** — учитывает порядок: прямые новости должны стоять выше косвенных.',
  '- **Нерелевантных в топ-3** — то, что пользователь назовет мусором.',
  '- **Совпадение с другими компаниями** — доля топ-3, которая попала и в топ-3 других компаний того же ракурса. Высокое значение значит, что отбор не персонализирован. Метрика не зависит от разметки.',
  '- **Не размечено** — новости, которых нет в пуле разметки. Они считаются нерелевантными, поэтому после изменения отбора пул нужно доразметить.',
  '',
  '## По компаниям',
  '',
  'В квадратных скобках — оценка из разметки.',
  '',
  ...details,
].join('\n')

const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`eval-ranking-${date}.md`, outDir), report)
console.log(summary.join('\n'))
console.log(`\nОтчет: results/eval-ranking-${date}.md`)
