import type { Perspective, Insight } from './model.js'
export const RANKING_VERSION = 'rules-2026-10-22.1'
export type RankingNews = {
  id: string
  title: string
  text: string
  publishedAt: string | null
  sourceId: string
}
export type RankingFeature = { id: string; value: string | null }
export type RankedNews = { news: RankingNews; relevance: Insight['relevance'] }
const norm = (s: string) => s.toLocaleLowerCase('ru').replaceAll('ё', 'е')
const finance = /(?:^|[^а-я])став(?:к|ок)|кредит|финансирован|инфляци|облигац|ликвидност/
const operations = /спрос|поставк|производств|логистик|рынок|продаж|тариф|санкци|пошлин/
const sectors = [
  /металл|стал[ьи]|сталь|прокат|чугун|ферросплав/,
  /угол|угл[яею]|кокс/,
  /рознич|магазин|ритейл|потребител/,
  /нефт|газ[аоу]?\b|топлив/,
  /сельск|аграр|зерн|урожай/,
  /транспорт|перевоз|логистик/,
  /строител|цемент|недвижим|ипотек/,
  /пищев|продукт.*питан|молочн/,
]
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const round = (n: number) => Math.round(n * 10000) / 10000
/** Explainable retrieval policy, not a trained probability of financial impact. */
export function rankNews(
  news: readonly RankingNews[],
  features: readonly RankingFeature[],
  perspective: Perspective,
  asOf: string,
  range?: { since: string; until: string },
  limit = 5,
): RankedNews[] {
  const at = Date.parse(asOf)
  if (!Number.isFinite(at)) throw new Error('Invalid ranking reference date')
  const values = new Map(
    features.filter((f) => f.value !== null).map((f) => [f.id, norm(f.value!)]),
  )
  const ranked: RankedNews[] = []
  const seen = new Set<string>()
  // Canonical input ordering makes duplicate IDs and tied scores independent of corpus order.
  for (const item of [...news].sort(
    (a, b) =>
      a.id.localeCompare(b.id) ||
      a.title.localeCompare(b.title) ||
      a.text.localeCompare(b.text) ||
      (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '') ||
      a.sourceId.localeCompare(b.sourceId),
  )) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const date = item.publishedAt ? Date.parse(item.publishedAt) : NaN
    if (Number.isFinite(date) && (date > at + 300000 || at - date > 90 * 86400000)) continue
    if (
      range &&
      (!Number.isFinite(date) || date < Date.parse(range.since) || date > Date.parse(range.until))
    )
      continue
    const text = norm(`${item.title} ${item.text}`)
    const explanations: { featureId: string; signal: string; weight: number }[] = []
    const add = (featureId: string, signal: string, weight: number) => {
      explanations.push({ featureId, signal, weight })
    }
    for (const [featureId, weight, label] of [
      ['industry', 0.65, 'Событие относится к отрасли компании'],
      ['group_industries', 0.2, 'Совпадение с отраслью участника группы'],
      ['supplier_industries', 0.18, 'Совпадение с наблюдаемой отраслью поставщиков'],
      ['customer_industries', 0.18, 'Совпадение с наблюдаемой отраслью покупателей'],
    ] as const) {
      if (featureId !== 'industry' && explanations.some((e) => e.featureId === 'industry')) continue // Do not count the same sector exposure twice.
      const industry = values.get(featureId)
      if (industry && sectors.some((re) => re.test(industry) && re.test(text)))
        add(featureId, label, weight)
    }
    if (finance.test(text)) {
      for (const id of ['loans', 'leasing', 'factoring', 'deposits'])
        if (values.get(id) === 'true')
          add(
            id,
            'Финансовое событие связано с известным продуктом банка',
            id === 'loans' ? 0.55 : 0.3,
          )
    }
    if (
      values.get('customs') &&
      /валют|курс|тамож|пошлин|санкци|международн|экспорт|импорт/.test(text)
    )
      add('customs', 'Известны страны ВЭД; направление торговли и валюта неизвестны', 0.4)
    const region = values
      .get('region')
      ?.split(/[\s,]+/)
      .find((w) => w.length >= 5 && !/област|респуб|край|город/.test(w))
    if (region && text.includes(region.slice(0, 6)))
      add('region', 'Событие затрагивает известный регион компании', 0.25)
    if (values.get('payroll') === 'true' && /зарплат|оплат.*труд|кадр|рынок труда/.test(text))
      add('payroll', 'Есть зарплатный проект; событие касается оплаты труда', 0.3)
    const companyFit = clamp(explanations.reduce((sum, e) => sum + e.weight, 0))
    if (companyFit === 0) continue // Freshness alone cannot establish relevance to a company.
    const perspectiveFit =
      perspective === 'cfo' ? (finance.test(text) ? 1 : 0.35) : operations.test(text) ? 1 : 0.35
    const freshness = Number.isFinite(date)
      ? Math.exp(-Math.max(0, at - date) / (14 * 86400000))
      : 0.15
    const sourceQuality = /^(cbr|government|rosstat|moex)/.test(item.sourceId) ? 1 : 0.65
    const score = round(
      clamp(companyFit * 0.6 + perspectiveFit * 0.2 + freshness * 0.15 + sourceQuality * 0.05),
    )
    ranked.push({
      news: item,
      relevance: {
        score,
        rank: 0,
        reasons: [...new Set(explanations.map((e) => e.featureId))],
        version: RANKING_VERSION,
        components: {
          companyFit: round(companyFit),
          perspectiveFit,
          freshness: round(freshness),
          sourceQuality,
        },
        explanations,
      },
    })
  }
  return ranked
    .sort(
      (a, b) =>
        b.relevance.score - a.relevance.score ||
        (b.news.publishedAt ?? '').localeCompare(a.news.publishedAt ?? '') ||
        a.news.id.localeCompare(b.news.id),
    )
    .slice(0, limit)
    .map((r, i) => ({ ...r, relevance: { ...r.relevance, rank: i + 1 } }))
}
