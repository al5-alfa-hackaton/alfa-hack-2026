export const FEATURE_IDS = [
  'industry',
  'revenue',
  'region',
  'loans',
  'guarantees',
  'leasing',
  'deposits',
  'payroll',
  'factoring',
  'customs',
  'group_industries',
  'supplier_industries',
  'customer_industries',
] as const

export type FeatureId = (typeof FEATURE_IDS)[number]

export const FEATURE_LABELS: Record<FeatureId, string> = {
  industry: 'Отрасль компании',
  revenue: 'Выручка компании',
  region: 'Регион компании',
  loans: 'Кредиты',
  guarantees: 'Банковские гарантии',
  leasing: 'Лизинг',
  deposits: 'Депозиты',
  payroll: 'Зарплатный проект',
  factoring: 'Факторинг',
  customs: 'Внешняя торговля',
  group_industries: 'Отрасли группы',
  supplier_industries: 'Поставщики',
  customer_industries: 'Покупатели',
}

export function isFeatureId(id: string): id is FeatureId {
  return (FEATURE_IDS as readonly string[]).includes(id)
}
