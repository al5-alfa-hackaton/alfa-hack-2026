import { emptyToNull, parseFlag, parseNumber, readCsv } from './csv.js'

export type Company = {
  id: string
  groupId: string | null
  ownership: string | null
  ageYears: string | null
  developmentStage: string | null
  okvedCode: string | null
  okvedName: string | null
  keyOwnerMark: boolean | null
  workersFns: string | null
  workersSpark: string | null
  clientType: string | null
  products: {
    settlement: boolean | null
    guarantees: boolean | null
    loans: boolean | null
    leasing: boolean | null
    deposits: boolean | null
    payroll: boolean | null
    factoring: boolean | null
  }
  customs: { hasRecords: boolean | null; countries: string[] }
  revenue: number | null
  city: string | null
  region: string | null
}

export type PaymentEdge = { counterpartyId: string; amount: number; count: number }

export type CompanyStore = {
  companies: Map<string, Company[]>
  groups: Map<string, string[]>
  personsByCompany: Map<string, string[]>
  companiesByPerson: Map<string, string[]>
  outgoing: Map<string, PaymentEdge[]>
  incoming: Map<string, PaymentEdge[]>
}

export type CompanyFiles = { companies: string; personLinks: string; payments: string }

function toCompany(r: Record<string, string>): Company {
  const countries = (r.FTS_COUNTRY_NAME ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  return {
    id: r.SYNTHETIC_U ?? '',
    groupId: emptyToNull(r.GROUP_ID),
    ownership: emptyToNull(r.OKFS_NAME),
    ageYears: emptyToNull(r.COMPANY_AGE_YEARS_GRADATION),
    developmentStage: emptyToNull(r.ECO_MARK_LABEL),
    okvedCode: emptyToNull(r.MAINOKVED_CODE),
    okvedName: emptyToNull(r.MAINOKVED_NAME),
    keyOwnerMark: parseFlag(r.NEGATIVEMARK),
    workersFns: emptyToNull(r.AMOUNT_WORKERS_FNS_GRADATION),
    workersSpark: emptyToNull(r.AMOUNT_WORKERS_SPARK_GRADATION),
    clientType: emptyToNull(r.CL_TYPE),
    products: {
      settlement: parseFlag(r.CL_PRODUCT_RKO_MARK),
      guarantees: parseFlag(r.CL_PRODUCT_GAR_MARK),
      loans: parseFlag(r.CL_PRODUCT_LOA_MARK),
      leasing: parseFlag(r.CL_PRODUCT_LEA_MARK),
      deposits: parseFlag(r.CL_PRODUCT_DEP_MARK),
      payroll: parseFlag(r.CL_PRODUCT_ZPP_MARK),
      factoring: parseFlag(r.FACTORING_MARK),
    },
    customs: { hasRecords: parseFlag(r.FTS_FLAG), countries },
    revenue: parseNumber(r.REVENUE_COMPANY),
    city: emptyToNull(r.CITY),
    region: emptyToNull(r.REGION),
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export async function loadCompanyStore(files: CompanyFiles): Promise<CompanyStore> {
  const store: CompanyStore = {
    companies: new Map(),
    groups: new Map(),
    personsByCompany: new Map(),
    companiesByPerson: new Map(),
    outgoing: new Map(),
    incoming: new Map(),
  }

  for await (const r of readCsv(files.companies)) {
    const company = toCompany(r)
    if (!company.id) continue
    push(store.companies, company.id, company)
    if (company.groupId) push(store.groups, company.groupId, company.id)
  }

  for await (const r of readCsv(files.personLinks)) {
    const person = r.SYNTHETIC_F
    const company = r.SYNTHETIC_U
    if (!person || !company) continue
    push(store.personsByCompany, company, person)
    push(store.companiesByPerson, person, company)
  }

  for await (const r of readCsv(files.payments)) {
    const payer = r.PAYER
    const beneficiary = r.BENEFICIARY
    const amount = parseNumber(r.PAY_AMT)
    const count = parseNumber(r.PAY_CNT)
    if (!payer || !beneficiary || amount === null || count === null) continue
    push(store.outgoing, payer, { counterpartyId: beneficiary, amount, count })
    push(store.incoming, beneficiary, { counterpartyId: payer, amount, count })
  }

  return store
}
