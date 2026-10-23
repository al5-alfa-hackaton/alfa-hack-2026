import { dataPaths, loadConfig } from '../config.js'
import { loadDataContext } from '../data/context.js'
import { rankNewsForCompany, tagCoverage } from '../news/ranking.js'
import { loadNewsTags } from '../news/tagging.js'

const [asOfArg, ...companyArgs] = process.argv.slice(2)
const companies = companyArgs.length ? companyArgs : ['U_1', 'U_9250', 'U_1595', 'U_57706', 'U_68157', 'U_3263']
const asOf = asOfArg && asOfArg !== '-' ? asOfArg : new Date().toISOString()
const config = loadConfig()
const ctx = await loadDataContext(config)
const tags = await loadNewsTags(dataPaths(config).newsTags)
const coverage = tagCoverage(ctx, tags)
console.log(`Размечено новостей: ${coverage.tagged} из ${coverage.news}. Дата анализа: ${asOf}\n`)
for (const companyId of companies) {
  const okved = ctx.companies.companies.get(companyId)?.[0]?.okvedName ?? '—'
  console.log(`# ${companyId} — ${okved}`)
  for (const perspective of ['cfo', 'ceo'] as const) {
    for (const r of rankNewsForCompany(ctx, tags, companyId, { perspective, asOf, limit: 3 })) {
      console.log(`  ${perspective} ${r.relevance.score.toFixed(2)} [${r.relevance.reasons.join(', ')}] ${r.news.title.slice(0, 90)}`)
    }
  }
  console.log()
}
