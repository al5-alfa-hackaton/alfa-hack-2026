import { createHash } from 'node:crypto'
import {
  companyProfile,
  companyGroup,
  companyCounterparties,
  type DataContext,
} from '@alfa/research-agent'
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
    const missingLabels: Record<string, string> = {
      revenue: 'Годовая выручка',
      developmentStage: 'Стадия развития бизнеса',
      workersSpark: 'Численность сотрудников по СПАРК',
      customs: 'Сведения о внешней торговле',
    }
    const company = this.list().find((c) => c.id === id)
    if (!company) throw new AppError('not_found', 'Компания недоступна')
    const p = companyProfile(this.ctx, id)
    const counterparties = companyCounterparties(this.ctx, id)
    const relatedIndustries = (side: unknown) => {
      const s = side as {
        industriesReliable?: boolean
        industriesByAmount?: { exampleName: string | null }[]
      }
      return s?.industriesReliable
        ? s.industriesByAmount?.flatMap((i) => (i.exampleName ? [i.exampleName] : [])).join('; ') ||
            null
        : null
    }
    const features = [
      ...(['leasing', 'deposits', 'payroll', 'factoring'] as const).map((key) => ({
        id: key,
        label: {
          leasing: 'Лизинг',
          deposits: 'Депозиты',
          payroll: 'Зарплатный проект',
          factoring: 'Факторинг',
        }[key],
        value: p.company.products[key] === null ? null : String(p.company.products[key]),
      })),
      {
        id: 'group_industries',
        label: 'Отрасли участников группы',
        value:
          companyGroup(this.ctx, id)
            .members.flatMap((m) => (m.okvedName ? [m.okvedName] : []))
            .join('; ') || null,
      },
      {
        id: 'supplier_industries',
        label: 'Наблюдаемые отрасли поставщиков',
        value: relatedIndustries(counterparties.suppliers),
      },
      {
        id: 'customer_industries',
        label: 'Наблюдаемые отрасли покупателей',
        value: relatedIndustries(counterparties.customers),
      },
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
      profileVersion: createHash('sha256')
        .update(JSON.stringify({ p, features }))
        .digest('hex')
        .slice(0, 20),
      corpusVersion: this.corpusVersion,
      dataMode: this.mode,
      features,
      gaps: [
        ...new Set([
          ...p.dataQuality.missingFields.map(
            (field) => missingLabels[field] ?? 'Дополнительные сведения о компании',
          ),
          ...features.filter((f) => f.value === null).map((f) => f.label),
        ]),
      ],
      limitations: [
        ...p.dataQuality.notes.map((note) =>
          note
            .replace(' (scaleBasis = group)', '')
            .replace(
              ' Значение 1000 — техническая заглушка, считается отсутствующим.',
              ' Неизвестные значения не подменяются оценками.',
            ),
        ),
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
