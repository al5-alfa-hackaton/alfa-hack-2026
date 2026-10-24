import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { companyCounterparties, companyGroup, companyProfile } from '../tools/functions.js'
import { FEATURE_LABELS, isFeatureId } from '../features.js'

const SETS = ['ranking-set.json', 'ranking-holdout.json', 'ranking-holdout-2.json']
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const sample = Number(arg('sample') ?? Infinity)
const seed = Number(arg('seed') ?? 1)

const config = loadConfig()
const ctx = await loadDataContext(config)

type Pair = { companyId: string; newsId: string }
const pairs: Pair[] = []
for (const file of SETS) {
  const set = JSON.parse(await readFile(new URL(`../../eval/${file}`, import.meta.url), 'utf8')) as { companies: { id: string; labels: Record<string, number> }[] }
  for (const c of set.companies) for (const newsId of Object.keys(c.labels)) pairs.push({ companyId: c.id, newsId })
}

let state = seed
const random = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const shuffled = pairs.map((p) => ({ p, k: random() })).sort((a, b) => a.k - b.k).map(({ p }) => p)
const chosen = shuffled.slice(0, sample)

const money = (n: number | null) => (n === null ? 'неизвестна' : `${(n / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд ₽`)
function companyCard(id: string) {
  const { company } = companyProfile(ctx, id)
  const group = companyGroup(ctx, id)
  const cp = companyCounterparties(ctx, id) as Record<string, { industriesReliable?: boolean; industriesByAmount?: { exampleName: string | null; share: number }[] } | undefined>
  const products = Object.entries(company.products)
    .filter(([, v]) => v)
    .map(([k]) => (isFeatureId(k) ? FEATURE_LABELS[k] : k))
  const side = (s: (typeof cp)[string]) =>
    s?.industriesReliable ? (s.industriesByAmount ?? []).slice(0, 3).map((i) => `${i.exampleName ?? '—'} (${Math.round(i.share * 100)}%)`).join('; ') : 'нет надежных данных'
  return {
    id,
    industry: company.okvedName,
    region: company.region ?? 'неизвестен',
    revenue: money(company.revenue),
    products: products.length ? products.join(', ') : 'нет продуктов Альфа-Банка',
    customs: company.customs.countries.length ? `страны ${company.customs.countries.join(', ')} (направление неизвестно)` : 'нет записей',
    group: group.groupSize > 1 ? group.memberIndustries.slice(0, 4).map((i) => `${i.name} — ${i.companies}`).join('; ') : 'нет группы',
    suppliers: side(cp.suppliers),
    customers: side(cp.customers),
  }
}

const companies = Object.fromEntries([...new Set(chosen.map((p) => p.companyId))].map((id) => [id, companyCard(id)]))
const news = Object.fromEntries(
  [...new Set(chosen.map((p) => p.newsId))].map((id) => {
    const n = ctx.news.find((x) => x.id === id)
    return [id, n ? { title: n.title, source: n.sourceName, date: n.publishedAt?.slice(0, 10) ?? '', text: n.text.slice(0, 1500), url: n.url } : { title: 'новость не найдена в корпусе', source: '', date: '', text: '', url: '' }]
  }),
)

const data = JSON.stringify({ pairs: chosen, companies, news }).replace(/</g, '\\u003c')
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Разметка новостей</title>
<style>
:root { --bg: #f6f6f4; --card: #fff; --text: #1d1d1b; --muted: #6b6b66; --line: #e2e2dc; --accent: #ef3124; --ok: #2f7d4f; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --card: #20201e; --text: #ececea; --muted: #a3a39c; --line: #34342f; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 16px; }
header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
h1 { font-size: 18px; margin: 0; }
.bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; flex: 1 1 200px; }
.bar i { display: block; height: 100%; background: var(--accent); width: 0; }
.grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
section { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 8px; }
dl { margin: 0; display: grid; grid-template-columns: 120px 1fr; gap: 4px 10px; }
dt { color: var(--muted); }
dd { margin: 0; }
.news-title { font-weight: 600; font-size: 16px; margin: 0 0 4px; }
.meta { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.text { white-space: pre-wrap; max-height: 320px; overflow: auto; }
.controls { margin-top: 12px; display: grid; gap: 10px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
button { font: inherit; border: 1px solid var(--line); background: var(--card); color: var(--text); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
button[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
input[type=text], textarea { font: inherit; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--text); }
.hint { color: var(--muted); font-size: 13px; }
kbd { border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; font-size: 12px; }
</style>
</head>
<body>
<main>
<header>
  <h1>Разметка: влияет ли новость на компанию</h1>
  <div class="bar" aria-hidden="true"><i id="bar"></i></div>
  <span id="progress"></span>
</header>
<section style="margin-bottom:12px">
  <div class="row"><label for="labeler">Ваше имя:</label><input id="labeler" type="text" style="max-width:260px" placeholder="например, Алеся"></div>
  <p class="hint">Оценка: <b>2</b> — прямо влияет на деньги компании (ее отрасль, продукты, сырье, ключевые затраты); <b>1</b> — косвенно (макроэкономика при наличии долга, курс при внешней торговле, смежная отрасль, группа); <b>0</b> — не связана. Роль: кому из руководителей новость важна напрямую — финансовому (ставка, курс, кредит) или генеральному (спрос, отрасль, регулирование). Клавиши: <kbd>0</kbd> <kbd>1</kbd> <kbd>2</kbd> — оценка, <kbd>Ф</kbd>/<kbd>A</kbd> — CFO, <kbd>Г</kbd>/<kbd>U</kbd> — CEO, <kbd>→</kbd> — дальше, <kbd>←</kbd> — назад.</p>
</section>
<div class="grid">
  <section aria-labelledby="c-h"><h2 id="c-h">Компания</h2><dl id="company"></dl></section>
  <section aria-labelledby="n-h"><h2 id="n-h">Новость</h2><p class="news-title" id="title"></p><div class="meta" id="meta"></div><div class="text" id="text"></div></section>
</div>
<section class="controls" aria-label="Оценка">
  <div class="row" role="group" aria-label="Оценка влияния"><span>Влияние:</span><button data-grade="0">0 — не связана</button><button data-grade="1">1 — косвенно</button><button data-grade="2">2 — прямо</button></div>
  <div class="row" role="group" aria-label="Роль"><span>Важна напрямую:</span><button data-role="cfo">финансовому директору</button><button data-role="ceo">генеральному директору</button></div>
  <textarea id="comment" rows="2" placeholder="Комментарий, если сомневаетесь (необязательно)"></textarea>
  <div class="row"><button id="prev">← Назад</button><button id="next" class="primary">Дальше →</button><span class="hint" id="status"></span><span style="flex:1"></span><button id="download">Скачать разметку</button></div>
</section>
</main>
<script>
const DATA = ${data};
const KEY = 'labeling-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const answers = saved.answers || {};
let index = Math.min(saved.index || 0, DATA.pairs.length - 1);
const $ = (id) => document.getElementById(id);
$('labeler').value = saved.labeler || '';
const keyOf = (p) => p.companyId + '|' + p.newsId;
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ answers, index, labeler: $('labeler').value })); } catch {} }
function render() {
  const p = DATA.pairs[index], c = DATA.companies[p.companyId], n = DATA.news[p.newsId], a = answers[keyOf(p)] || {};
  const rows = [['Отрасль', c.industry], ['Регион', c.region], ['Выручка', c.revenue], ['Продукты', c.products], ['ВЭД', c.customs], ['Группа', c.group], ['Поставщики', c.suppliers], ['Покупатели', c.customers]];
  $('company').replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; return [dt, dd]; }));
  $('title').textContent = n.title;
  $('meta').textContent = [n.source, n.date].filter(Boolean).join(' · ');
  $('text').textContent = n.text || 'Текста нет — оценивайте по заголовку.';
  document.querySelectorAll('[data-grade]').forEach((b) => b.setAttribute('aria-pressed', String(a.grade === Number(b.dataset.grade))));
  document.querySelectorAll('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String((a.roles || []).includes(b.dataset.role))));
  $('comment').value = a.comment || '';
  const done = DATA.pairs.filter((x) => answers[keyOf(x)] && answers[keyOf(x)].grade !== undefined).length;
  $('progress').textContent = (index + 1) + ' / ' + DATA.pairs.length + ' · размечено ' + done;
  $('bar').style.width = (100 * done / DATA.pairs.length) + '%';
  $('status').textContent = a.grade === undefined ? 'нет оценки' : '';
}
function update(patch) { const k = keyOf(DATA.pairs[index]); answers[k] = { ...(answers[k] || {}), ...patch }; persist(); render(); }
document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => update({ grade: Number(b.dataset.grade) })));
document.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => { const k = keyOf(DATA.pairs[index]); const roles = new Set((answers[k] || {}).roles || []); roles.has(b.dataset.role) ? roles.delete(b.dataset.role) : roles.add(b.dataset.role); update({ roles: [...roles] }); }));
$('comment').addEventListener('input', (e) => { const k = keyOf(DATA.pairs[index]); answers[k] = { ...(answers[k] || {}), comment: e.target.value }; persist(); });
$('labeler').addEventListener('input', persist);
const go = (d) => { index = Math.max(0, Math.min(DATA.pairs.length - 1, index + d)); persist(); render(); };
$('next').addEventListener('click', () => go(1));
$('prev').addEventListener('click', () => go(-1));
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (['0', '1', '2'].includes(e.key)) update({ grade: Number(e.key) });
  else if (['ф', 'a', 'Ф', 'A'].includes(e.key)) document.querySelector('[data-role=cfo]').click();
  else if (['г', 'u', 'Г', 'U'].includes(e.key)) document.querySelector('[data-role=ceo]').click();
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
});
$('download').addEventListener('click', () => {
  const labeler = $('labeler').value.trim() || 'без имени';
  const labels = DATA.pairs.map((p) => ({ ...p, ...(answers[keyOf(p)] || {}) })).filter((x) => x.grade !== undefined);
  const blob = new Blob([JSON.stringify({ labeler, createdAt: new Date().toISOString(), labels }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'razmetka-' + labeler.replace(/\\s+/g, '_') + '.json';
  a.click();
});
render();
</script>
</body>
</html>
`

const outDir = `${dataPaths(config).processed}/labeling`
await mkdir(outDir, { recursive: true })
const file = `${outDir}/razmetka${Number.isFinite(sample) ? `-${sample}` : ''}.html`
await writeFile(file, html)
console.log(`Пар: ${chosen.length} из ${pairs.length}, компаний: ${Object.keys(companies).length}. Файл: ${file}`)
