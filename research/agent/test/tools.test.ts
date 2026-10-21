import { describe, expect, it } from 'vitest'
import { tokenize } from '../src/search/bm25.js'
import { bankSearch, companyCounterparties, companyGroup, companyProfile, evidenceVerify, newsSearch } from '../src/tools/functions.js'
import { createTools } from '../src/tools/index.js'
import { fixtureContext } from './helpers.js'

const ctx = await fixtureContext()

describe('company tools', () => {
  it('parses flags and keeps unknown values as null', () => {
    const { company, derived } = companyProfile(ctx, 'U_1')
    expect(company.products.loans).toBe(true)
    expect(company.products.deposits).toBe(false)
    expect(company.workersSpark).toBeNull()
    expect(derived.scale).toBe('large')
    expect(derived.foreignTradeCountries).toEqual(['КИТАЙ', 'ТУРЦИЯ'])
    expect(companyProfile(ctx, 'U_3').company.revenue).toBeNull()
    expect(companyProfile(ctx, 'U_3').derived.revenueAbove15bn).toBeNull()
  })

  it('treats revenue 1000 as a placeholder', () => {
    const { company, dataQuality } = companyProfile(ctx, 'U_4')
    expect(company.revenue).toBeNull()
    expect(dataQuality.missingFields).toContain('revenue')
  })

  it('derives scale from group revenue and flags non-clients', () => {
    const member = companyProfile(ctx, 'U_2')
    expect(member.company.revenue).toBe(900000000)
    expect(member.derived).toMatchObject({ scale: 'large', scaleBasis: 'group', groupRevenue: 30900000000, isActiveClient: false })
    expect(companyProfile(ctx, 'U_3').derived).toMatchObject({ scale: 'unknown', scaleBasis: 'company', groupRevenue: null })
    expect(companyProfile(ctx, 'U_1').derived.isActiveClient).toBe(true)
  })

  it('finds group members and companies sharing a linked person', () => {
    const group = companyGroup(ctx, 'U_1')
    expect(group.members.map((m) => m.id)).toEqual(['U_2'])
    expect(group.affiliatedViaPersons).toMatchObject([{ id: 'U_3', sharedPersons: 1 }])
  })

  it('excludes self-payments and reports unknown counterparties', () => {
    const result = companyCounterparties(ctx, 'U_1') as Record<string, any>
    expect(result.suppliers.selfPaymentsAmount).toBe(5000)
    expect(result.suppliers.totalAmount).toBe(1000)
    expect(result.suppliers.top1Share).toBe(0.6)
    expect(result.suppliers.unknownProfileShare).toBe(0.4)
    expect(result.customers.top[0]).toMatchObject({ id: 'U_2', amount: 1000 })
  })
})

describe('search and evidence', () => {
  it('matches Russian word forms', () => {
    expect(tokenize('ключевой ставки')[1]).toBe(tokenize('ставка')[0])
    expect(tokenize('цены нефти')).toEqual(tokenize('цена нефть'))
    expect(newsSearch(ctx, 'ключевой ставки').results[0]?.documentId).toBe('news_rate')
    expect(bankSearch(ctx, 'заемное финансирование').results[0]?.page).toBe(1)
  })

  it('verifies literal quotes and rejects invented ones', () => {
    const [real, fake, unknown] = evidenceVerify(ctx, [
      { documentId: 'bank_test', quote: 'Мы  ожидаем сохранения ставки до конца года' },
      { documentId: 'bank_test', quote: 'Банк рекомендует продать все облигации' },
      { documentId: 'nope', quote: 'Мы ожидаем сохранения ставки' },
    ])
    expect(real).toMatchObject({ verified: true, page: 1 })
    expect(fake).toMatchObject({ verified: false, reason: 'not_found_in_document' })
    expect(unknown).toMatchObject({ verified: false, reason: 'unknown_document' })
  })
})

describe('tool wrappers', () => {
  it('take company scope from run config, not from model arguments', async () => {
    const audit: never[] = []
    const profile = createTools(ctx, audit).find((t) => t.name === 'company_profile')!
    const ok = JSON.parse(await profile.invoke({}, { configurable: { companyId: 'U_2' } }))
    expect(ok.company.id).toBe('U_2')
    expect(JSON.parse(await profile.invoke({}, {}))).toEqual({ error: 'Run scope is missing companyId' })
    expect(audit).toHaveLength(2)
  })
})
