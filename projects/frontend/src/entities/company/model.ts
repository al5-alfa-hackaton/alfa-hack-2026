export type Role = 'cfo' | 'ceo'
export const roles: Record<Role, string> = {
  cfo: 'Финансовый директор',
  ceo: 'Генеральный директор',
}
const featureMessages: Record<string, { label: string; reason: string }> = {
  industry: { label: 'Отрасль компании', reason: 'Событие затрагивает отрасль вашей компании' },
  group_industries: {
    label: 'Отрасли группы',
    reason: 'Событие связано с отраслями компаний вашей группы',
  },
  supplier_industries: {
    label: 'Поставщики',
    reason: 'Событие затрагивает отрасли ваших поставщиков',
  },
  customer_industries: {
    label: 'Покупатели',
    reason: 'Событие затрагивает отрасли ваших покупателей',
  },
  loans: { label: 'Кредиты', reason: 'Связано с кредитованием вашей компании' },
  leasing: { label: 'Лизинг', reason: 'Связано с лизингом вашей компании' },
  guarantees: {
    label: 'Банковские гарантии',
    reason: 'Связано с банковскими гарантиями вашей компании',
  },
  deposits: { label: 'Депозиты', reason: 'Связано с размещением средств компании на депозитах' },
  factoring: {
    label: 'Факторинг',
    reason: 'Связано с факторинговым финансированием вашей компании',
  },
  payroll: {
    label: 'Зарплатный проект',
    reason: 'Связано с оплатой труда и зарплатным проектом компании',
  },
  customs: {
    label: 'Внешняя торговля',
    reason: 'Событие связано с внешнеторговыми связями компании',
  },
  revenue: { label: 'Выручка компании', reason: 'Связано с выручкой и масштабом вашей компании' },
  region: { label: 'Регион компании', reason: 'Событие затрагивает регион вашей компании' },
}

export function featureLabel(id: string, fallback?: string) {
  return (
    featureMessages[id]?.label ?? (fallback && fallback !== id ? fallback : 'Особенности компании')
  )
}

export function relevanceReason(id: string) {
  return featureMessages[id]?.reason ?? 'Связано с особенностями вашей компании'
}

export function featureValue(value: string | null, featureId?: string) {
  if (featureId === 'revenue' && value !== null && Number.isFinite(Number(value)))
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(Number(value))
  return value === null ? 'Нет данных' : value === 'true' ? 'Да' : value === 'false' ? 'Нет' : value
}
