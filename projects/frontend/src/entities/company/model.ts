export type Role = 'cfo' | 'ceo'
export const roles: Record<Role, string> = {
  cfo: 'Финансовый директор',
  ceo: 'Генеральный директор',
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
