import { isActiveClient, type Company, type PaymentEdge } from '../data/companies.js'
import type { DataContext } from '../data/context.js'
import { normalizeForMatch } from '../data/text.js'

const LARGE_BUSINESS_REVENUE = 15e9
const MAX_UNKNOWN_PROFILE_SHARE = 0.5

export class ToolError extends Error {}

function okvedDivision(code: string | null): string | null {
  return code ? (code.split('.')[0] ?? null) : null
}

function scaleOf(revenue: number | null): string {
  if (revenue === null) return 'unknown'
  if (revenue >= LARGE_BUSINESS_REVENUE) return 'large'
  if (revenue >= 2e9) return 'upper_mid'
  if (revenue >= 800e6) return 'mid'
  return 'small'
}

function pickRow(rows: Company[]): Company {
  return [...rows].sort((a, b) => (b.revenue ?? -1) - (a.revenue ?? -1))[0]!
}

function findCompany(ctx: DataContext, companyId: string): Company | undefined {
  const rows = ctx.companies.companies.get(companyId)
  return rows?.length ? pickRow(rows) : undefined
}

function primaryRow(ctx: DataContext, companyId: string): { company: Company; duplicates: number } {
  const rows = ctx.companies.companies.get(companyId)
  if (!rows?.length) throw new ToolError(`Company ${companyId} not found`)
  return { company: pickRow(rows), duplicates: rows.length - 1 }
}

type GroupRevenue = { revenue: number | null; companies: number; companiesWithoutRevenue: number }

const groupRevenueCache = new WeakMap<DataContext, Map<string, GroupRevenue>>()

function groupRevenueOf(ctx: DataContext, groupId: string): GroupRevenue {
  let cache = groupRevenueCache.get(ctx)
  if (!cache) groupRevenueCache.set(ctx, (cache = new Map()))
  const cached = cache.get(groupId)
  if (cached) return cached
  const ids = ctx.companies.groups.get(groupId) ?? []
  let revenue = 0
  let missing = 0
  for (const id of ids) {
    const r = findCompany(ctx, id)?.revenue ?? null
    if (r === null) missing++
    else revenue += r
  }
  const result = { revenue: missing === ids.length ? null : revenue, companies: ids.length, companiesWithoutRevenue: missing }
  cache.set(groupId, result)
  return result
}

function scaleFor(ctx: DataContext, c: Company) {
  const group = c.groupId ? groupRevenueOf(ctx, c.groupId) : null
  const basis = group?.revenue != null ? 'group' : 'company'
  return { scale: scaleOf(basis === 'group' ? group!.revenue : c.revenue), scaleBasis: basis, group }
}

function briefCompany(ctx: DataContext, c: Company) {
  const { scale, scaleBasis } = scaleFor(ctx, c)
  return {
    id: c.id,
    okved: c.okvedCode,
    okvedName: c.okvedName,
    revenue: c.revenue,
    scale,
    scaleBasis,
    region: c.region,
  }
}

export function companyProfile(ctx: DataContext, companyId: string) {
  const { company: c, duplicates } = primaryRow(ctx, companyId)
  const debtProducts = (['loans', 'leasing', 'guarantees', 'factoring'] as const).filter((p) => c.products[p])
  const { scale, scaleBasis, group } = scaleFor(ctx, c)
  const scaleRevenue = scaleBasis === 'group' ? group!.revenue : c.revenue
  const gaps: string[] = []
  if (c.revenue === null) gaps.push('revenue')
  if (!c.developmentStage) gaps.push('developmentStage')
  if (!c.workersSpark) gaps.push('workersSpark')
  if (c.customs.hasRecords === null) gaps.push('customs')

  return {
    company: c,
    derived: {
      isActiveClient: isActiveClient(c),
      scale,
      scaleBasis,
      groupRevenue: group?.revenue ?? null,
      groupCompaniesWithoutRevenue: group?.companiesWithoutRevenue ?? null,
      revenueAbove15bn: scaleRevenue === null ? null : scaleRevenue >= LARGE_BUSINESS_REVENUE,
      okvedDivision: okvedDivision(c.okvedCode),
      usesAlfaDebtProducts: debtProducts,
      hasForeignTrade: c.customs.hasRecords,
      foreignTradeCountries: c.customs.countries,
      foreignTradeDirection: c.customs.hasRecords ? 'unknown: ФТС дает только страны, не экспорт или импорт и не валюту' : null,
      groupSize: group?.companies ?? 1,
      linkedPersons: ctx.companies.personsByCompany.get(c.id)?.length ?? 0,
    },
    dataQuality: {
      missingFields: gaps,
      duplicateRowsForId: duplicates,
      notes: [
        'Банковские продукты отражают только отношения с Альфа-Банком; продукты других банков неизвестны.',
        'Выручка — за 2025 год, в рублях. Значение 1000 — техническая заглушка, считается отсутствующим.',
        'Масштаб оценен по суммарной выручке группы (scaleBasis = group), если она известна; это оценка, а не сегмент банка: группы с выручкой выше 15 млрд встречаются и в среднем бизнесе.',
        ...(group?.companiesWithoutRevenue ? ['Выручка группы занижена: у части участников выручка неизвестна.'] : []),
      ],
    },
  }
}

export function companyGroup(ctx: DataContext, companyId: string, limit = 20) {
  const { company } = primaryRow(ctx, companyId)
  const memberIds = company.groupId ? (ctx.companies.groups.get(company.groupId) ?? []) : []
  const members = memberIds
    .filter((id) => id !== companyId)
    .map((id) => findCompany(ctx, id))
    .filter((c): c is Company => Boolean(c))
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))

  const viaPersons = new Map<string, string[]>()
  for (const person of ctx.companies.personsByCompany.get(companyId) ?? []) {
    for (const other of ctx.companies.companiesByPerson.get(person) ?? []) {
      if (other === companyId) continue
      viaPersons.set(other, [...(viaPersons.get(other) ?? []), person])
    }
  }
  const affiliated = [...viaPersons].slice(0, limit).map(([id, persons]) => {
    const c = findCompany(ctx, id)
    return { ...(c ? briefCompany(ctx, c) : { id, profileKnown: false }), sharedPersons: persons.length }
  })

  const group = company.groupId ? groupRevenueOf(ctx, company.groupId) : null
  const divisions = new Map<string, number>()
  for (const c of [company, ...members]) {
    const d = okvedDivision(c.okvedCode)
    if (d) divisions.set(d, (divisions.get(d) ?? 0) + 1)
  }

  return {
    groupId: company.groupId,
    groupSize: memberIds.length,
    groupRevenue: group?.revenue ?? company.revenue,
    groupCompaniesWithoutRevenue: group?.companiesWithoutRevenue ?? (company.revenue === null ? 1 : 0),
    groupOkvedDivisions: [...divisions].sort((a, b) => b[1] - a[1]).map(([okvedDivision, companies]) => ({ okvedDivision, companies })),
    members: members.slice(0, limit).map((c) => briefCompany(ctx, c)),
    affiliatedViaPersons: affiliated,
  }
}

function summarizeEdges(ctx: DataContext, companyId: string, allEdges: PaymentEdge[], limit: number) {
  const selfAmount = allEdges.filter((e) => e.counterpartyId === companyId).reduce((s, e) => s + e.amount, 0)
  const edges = allEdges.filter((e) => e.counterpartyId !== companyId)
  const total = edges.reduce((s, e) => s + e.amount, 0)
  const byCounterparty = new Map<string, { amount: number; count: number }>()
  for (const e of edges) {
    const cur = byCounterparty.get(e.counterpartyId) ?? { amount: 0, count: 0 }
    byCounterparty.set(e.counterpartyId, { amount: cur.amount + e.amount, count: cur.count + e.count })
  }
  const sorted = [...byCounterparty].sort((a, b) => b[1].amount - a[1].amount)
  const share = (x: number) => (total > 0 ? Math.round((x / total) * 1000) / 1000 : 0)

  const industries = new Map<string, { name: string | null; amount: number }>()
  let unknownAmount = 0
  for (const [id, agg] of sorted) {
    const c = findCompany(ctx, id)
    const d = okvedDivision(c?.okvedCode ?? null)
    if (!c || !d) {
      unknownAmount += agg.amount
      continue
    }
    const cur = industries.get(d) ?? { name: c.okvedName, amount: 0 }
    industries.set(d, { name: cur.name, amount: cur.amount + agg.amount })
  }

  return {
    counterparties: byCounterparty.size,
    selfPaymentsAmount: selfAmount,
    totalAmount: total,
    top1Share: share(sorted[0]?.[1].amount ?? 0),
    top5Share: share(sorted.slice(0, 5).reduce((s, [, a]) => s + a.amount, 0)),
    unknownProfileShare: share(unknownAmount),
    industriesByAmount: [...industries]
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 8)
      .map(([division, v]) => ({ okvedDivision: division, exampleName: v.name, share: share(v.amount) })),
    top: sorted.slice(0, limit).map(([id, agg]) => {
      const c = findCompany(ctx, id)
      return { ...(c ? briefCompany(ctx, c) : { id, profileKnown: false }), amount: agg.amount, payments: agg.count, share: share(agg.amount) }
    }),
  }
}

export function companyCounterparties(
  ctx: DataContext,
  companyId: string,
  direction: 'suppliers' | 'customers' | 'both' = 'both',
  limit = 10,
) {
  const { company } = primaryRow(ctx, companyId)
  const result: Record<string, unknown> = {
    note: 'Платежи в рублях с 1 января текущего года и только те, что видит Альфа-Банк. Это сигнал связей, а не доказательство зависимости бизнеса.',
  }
  const withCoverage = (summary: ReturnType<typeof summarizeEdges>) => {
    const shareOfRevenue = company.revenue ? Math.round((summary.totalAmount / company.revenue) * 1000) / 1000 : null
    const industriesReliable = summary.totalAmount > 0 && summary.unknownProfileShare <= MAX_UNKNOWN_PROFILE_SHARE
    return {
      ...summary,
      shareOfRevenue,
      industriesReliable,
      ...(industriesReliable ? {} : { warning: 'Отрасли контрагентов известны для малой части объема — по ним нельзя судить, кто покупатели или поставщики компании.' }),
    }
  }
  if (direction !== 'customers') result.suppliers = withCoverage(summarizeEdges(ctx, companyId, ctx.companies.outgoing.get(companyId) ?? [], limit))
  if (direction !== 'suppliers') result.customers = withCoverage(summarizeEdges(ctx, companyId, ctx.companies.incoming.get(companyId) ?? [], limit))
  return result
}

const SNIPPET = 400

export function newsSearch(
  ctx: DataContext,
  query: string,
  opts: { since?: string; until?: string; sourceIds?: string[]; limit?: number } = {},
) {
  const filter = (n: DataContext['news'][number]) =>
    (!opts.since || (n.publishedAt ?? '') >= opts.since) &&
    (!opts.until || (n.publishedAt ?? '') <= opts.until) &&
    (!opts.sourceIds?.length || opts.sourceIds.includes(n.sourceId))
  return {
    corpusSize: ctx.news.length,
    results: ctx.newsIndex.search(query, opts.limit ?? 8, filter).map(({ item, score }) => ({
      documentId: item.id,
      source: item.sourceName,
      title: item.title,
      publishedAt: item.publishedAt,
      url: item.url,
      snippet: item.text.slice(0, SNIPPET),
      score: Math.round(score * 100) / 100,
    })),
  }
}

export function bankSearch(ctx: DataContext, query: string, limit = 5) {
  return {
    corpusDocuments: ctx.bank.documents.length,
    results: ctx.bankIndex.search(query, limit).map(({ item, score }) => {
      const note = ctx.bank.documents.find((d) => d.id === item.documentId)?.note
      return {
        documentId: item.documentId,
        title: item.title,
        publishedAt: item.publishedAt,
        ...(note ? { note } : {}),
        page: item.page,
        text: item.text,
        score: Math.round(score * 100) / 100,
      }
    }),
  }
}

const MAX_READ = 4000

export function documentRead(ctx: DataContext, documentId: string, opts: { page?: number; offset?: number; length?: number } = {}) {
  const length = Math.min(opts.length ?? 2000, MAX_READ)
  const offset = Math.max(0, opts.offset ?? 0)

  const bankDoc = ctx.bank.documents.find((d) => d.id === documentId)
  if (bankDoc) {
    const page = opts.page ?? 1
    const text = bankDoc.pages[page - 1]
    if (text === undefined) throw new ToolError(`Page ${page} out of range (1..${bankDoc.pages.length})`)
    return { documentId, sourceKind: 'bank', title: bankDoc.title, publishedAt: bankDoc.publishedAt, page, totalPages: bankDoc.pages.length, offset, text: text.slice(offset, offset + length), totalLength: text.length }
  }

  const news = ctx.news.find((n) => n.id === documentId)
  if (news) {
    return { documentId, sourceKind: 'news', title: news.title, url: news.url, publishedAt: news.publishedAt, offset, text: news.text.slice(offset, offset + length), totalLength: news.text.length }
  }
  throw new ToolError(`Document ${documentId} not found`)
}

export function evidenceVerify(ctx: DataContext, items: { documentId: string; quote: string }[]) {
  return items.map(({ documentId, quote }) => {
    const needle = normalizeForMatch(quote)
    if (needle.length < 12) return { documentId, quote, verified: false, reason: 'quote_too_short' }

    const bankDoc = ctx.bank.documents.find((d) => d.id === documentId)
    if (bankDoc) {
      const page = bankDoc.pages.findIndex((p) => normalizeForMatch(p).includes(needle))
      return page >= 0
        ? { documentId, quote, verified: true, sourceKind: 'bank', page: page + 1 }
        : { documentId, quote, verified: false, reason: 'not_found_in_document' }
    }
    const news = ctx.news.find((n) => n.id === documentId)
    if (news) {
      const found = normalizeForMatch(`${news.title} ${news.text}`).includes(needle)
      return found
        ? { documentId, quote, verified: true, sourceKind: 'news' }
        : { documentId, quote, verified: false, reason: 'not_found_in_document' }
    }
    return { documentId, quote, verified: false, reason: 'unknown_document' }
  })
}
