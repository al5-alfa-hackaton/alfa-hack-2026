import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { agreement, type ExpertLabels } from '../eval/labels.js'

type LabelFile = { labeler: string; labels: { companyId: string; newsId: string; grade: number; roles?: string[]; comment?: string }[] }

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!files.length) throw new Error('Использование: pnpm eval:import-labels <razmetka-имя.json> [...]')

const SETS = ['ranking-set.json', 'ranking-holdout.json', 'ranking-holdout-2.json']
const assistant = new Map<string, number>()
for (const file of SETS) {
  const set = JSON.parse(await readFile(new URL(`../../eval/${file}`, import.meta.url), 'utf8')) as { companies: { id: string; labels: Record<string, number> }[] }
  for (const c of set.companies) for (const [newsId, grade] of Object.entries(c.labels)) assistant.set(`${c.id}|${newsId}`, grade)
}

const storePath = new URL('../../eval/expert-labels.json', import.meta.url)
const store: ExpertLabels = existsSync(storePath) ? JSON.parse(await readFile(storePath, 'utf8')) : { pairs: {} }
const labelers = new Set<string>()
for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8')) as LabelFile
  labelers.add(data.labeler)
  for (const l of data.labels) {
    const key = `${l.companyId}|${l.newsId}`
    if (![0, 1, 2].includes(l.grade)) continue
    const pair = (store.pairs[key] ??= { grades: {}, roles: {}, comments: {} })
    pair.grades[data.labeler] = l.grade
    pair.roles[data.labeler] = (l.roles ?? []).filter((r) => r === 'cfo' || r === 'ceo')
    if (l.comment?.trim()) pair.comments[data.labeler] = l.comment.trim()
  }
}
await writeFile(storePath, JSON.stringify(store, null, 1))

const names = [...new Set(Object.values(store.pairs).flatMap((p) => Object.keys(p.grades)))]
const row = (a: string, b: string, get: (key: string, who: string) => number | undefined) => {
  const both = Object.keys(store.pairs).flatMap((key) => {
    const x = get(key, a)
    const y = get(key, b)
    return x === undefined || y === undefined ? [] : [[x, y] as [number, number]]
  })
  const s = agreement(both)
  return `| ${a} | ${b} | ${s.n} | ${Math.round(s.exact * 100)}% | ${Math.round(s.withinOne * 100)}% | ${s.kappa.toFixed(2)} |`
}
const grade = (key: string, who: string) => (who === 'ассистент' ? assistant.get(key) : store.pairs[key]?.grades[who])
const rows = [...names.map((n) => row(n, 'ассистент', grade)), ...names.flatMap((a, i) => names.slice(i + 1).map((b) => row(a, b, grade)))]

const disputed = Object.entries(store.pairs)
  .filter(([key, p]) => Object.values(p.grades).some((g) => Math.abs(g - (assistant.get(key) ?? g)) >= 2))
  .map(([key, p]) => `- ${key}: ассистент ${assistant.get(key)}, ${Object.entries(p.grades).map(([w, g]) => `${w} ${g}`).join(', ')}${Object.values(p.comments).length ? ` — ${Object.values(p.comments).join('; ')}` : ''}`)

const date = new Date().toISOString().slice(0, 10)
const report = [
  `# Согласие разметки — ${date}`,
  '',
  `Разметчиков: ${names.join(', ')}. Пар с оценкой человека: ${Object.keys(store.pairs).length}. Хранилище: \`eval/expert-labels.json\`.`,
  '',
  '- **Совпадение** — доля пар с одинаковой оценкой 0/1/2.',
  '- **±1** — оценки отличаются не больше чем на 1.',
  '- **Каппа** — взвешенная каппа Коэна: 1 — полное согласие, 0 — как случайно; выше 0,6 — разметке можно доверять.',
  '',
  '| Разметчик | С кем | Пар | Совпадение | ±1 | Каппа |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  '## Сильные расхождения с ассистентом (разница 2)',
  '',
  ...(disputed.length ? disputed : ['Нет.']),
  '',
].join('\n')
const outDir = new URL('../../results/', import.meta.url)
await mkdir(outDir, { recursive: true })
await writeFile(new URL(`label-agreement-${date}.md`, outDir), report)
console.log(rows.join('\n'))
console.log(`\nОтчет: results/label-agreement-${date}.md. Оценки людей теперь используются в eval:ranking вместо оценок ассистента.`)
