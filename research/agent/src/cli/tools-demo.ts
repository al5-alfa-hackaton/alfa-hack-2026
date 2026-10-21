import { loadConfig } from '../config.js'
import { isActiveClient } from '../data/companies.js'
import { loadDataContext } from '../data/context.js'
import { bankSearch, companyCounterparties, companyGroup, companyProfile, evidenceVerify, newsSearch } from '../tools/functions.js'

const [companyArg, queryArg] = process.argv.slice(2)
const started = Date.now()
const ctx = await loadDataContext(loadConfig())
console.log(`Данные загружены за ${((Date.now() - started) / 1000).toFixed(1)} c: ${ctx.companies.companies.size} компаний, ${ctx.bank.documents.length} материалов банка, ${ctx.news.length} новостей\n`)

const companyId =
  companyArg ??
  [...ctx.companies.companies.values()]
    .map((rows) => rows[0]!)
    .filter((c) => isActiveClient(c) && c.products.loans && c.customs.hasRecords)
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0]!.id
const query = queryArg ?? 'ключевая ставка'

const show = (title: string, value: unknown) => console.log(`=== ${title}\n${JSON.stringify(value, null, 2).slice(0, 3000)}\n`)

show(`company_profile ${companyId}`, companyProfile(ctx, companyId))
show('company_group', companyGroup(ctx, companyId, 5))
show('company_counterparties', companyCounterparties(ctx, companyId, 'both', 5))
const news = newsSearch(ctx, query, { limit: 3 })
show(`news_search "${query}"`, news)
const bank = bankSearch(ctx, query, 3)
show(`bank_search "${query}"`, bank)

const top = bank.results[0]
if (top) {
  show('evidence_verify (настоящая и выдуманная цитаты)', evidenceVerify(ctx, [
    { documentId: top.documentId, quote: top.text.slice(50, 160) },
    { documentId: top.documentId, quote: 'Альфа-Банк рекомендует всем клиентам срочно продать облигации' },
  ]))
}
