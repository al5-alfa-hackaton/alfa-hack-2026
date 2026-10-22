import { createHash } from 'node:crypto'
import { companyProfile, type DataContext } from '@alfa/research-agent'
import { AppError } from '../../../shared/kernel/errors.js'
import type { CompanyCatalog, CompanyContext } from '../application/catalog.js'
export class ResearchCatalog implements CompanyCatalog {
  readonly corpusVersion: string
  constructor(
    private readonly ctx: DataContext,
    private readonly mode: 'fixture' | 'research',
  ) {
    this.corpusVersion = createHash('sha256')
      .update(JSON.stringify([ctx.news, ctx.bank]))
      .digest('hex')
      .slice(0, 20)
  }
  list() {
    return [...this.ctx.companies.companies.entries()]
      .filter(([, rows]) => rows.some((r) => r.clientType === 'CLIENT'))
      .map(([id, rows]) => ({
        id,
        displayName: `Компания ${id}`,
        industry: rows[0]?.okvedName ?? null,
        region: rows[0]?.region ?? null,
      }))
  }
  context(id: string): CompanyContext {
    const company = this.list().find((c) => c.id === id)
    if (!company) throw new AppError('not_found', 'Компания недоступна')
    const p = companyProfile(this.ctx, id)
    const features = [
      { id: 'industry', label: 'Отрасль', value: p.company.okvedName },
      {
        id: 'revenue',
        label: 'Выручка, RUB (2025)',
        value: p.company.revenue === null ? null : String(p.company.revenue),
      },
      { id: 'region', label: 'Регион', value: p.company.region },
      {
        id: 'loans',
        label: 'Кредиты в Альфа-Банке',
        value: p.company.products.loans === null ? null : String(p.company.products.loans),
      },
      {
        id: 'customs',
        label: 'Страны ВЭД (направление неизвестно)',
        value: p.company.customs.countries.join(', ') || null,
      },
    ]
    return {
      company,
      profileVersion: createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 20),
      corpusVersion: this.corpusVersion,
      dataMode: this.mode,
      features,
      gaps: [
        ...new Set([
          ...p.dataQuality.missingFields,
          ...features.filter((f) => f.value === null).map((f) => f.label),
        ]),
      ],
      limitations: [
        ...p.dataQuality.notes,
        ...(p.dataQuality.duplicateRowsForId
          ? ['В данных есть дубликаты ID; выбран профиль с наибольшей известной выручкой.']
          : []),
        'Платежи отражают только операции через Альфа-Банк.',
        'Направление ВЭД, валюта и условия долга неизвестны.',
        ...(this.mode === 'fixture' ? ['Синтетический набор для локальной проверки.'] : []),
      ],
    }
  }
}
