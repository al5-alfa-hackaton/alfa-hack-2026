import { toast } from 'sonner'
import { companies, roles, type CompanyId, type Role } from '@/entities/company'
import type { News } from '@/entities/insight'

export function exportDigest(items: News[], companyId: CompanyId, role: Role) {
  const text = [
    'ДЕМО · Синтетическая сводка · Данные на 21.10.2026',
    companies[companyId].name,
    roles[role],
    'Не является реальной аналитикой банка.',
    ...items.map(
      (item) =>
        `\n${item.title}\n${item.context[companyId].impact}\nОснование: ${item.context[companyId].reason}\nИсточник: ${item.source}`,
    ),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `alfa-demo-${companyId}-${role}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast.success('Учебная сводка скачана')
}
