import { toast } from 'sonner'
import { roles, type Role } from '@/entities/company'
import type { Insight } from '@/entities/insight'

export function digestText(items: Insight[], companyName: string, role: Role) {
  return [
    'Новостная аналитика',
    companyName,
    roles[role],
    ...items.map((item) =>
      [
        '\n' + item.event.title,
        'Сформировано: ' + item.generatedAt,
        item.summary,
        'Основания: ' + item.relevance.reasons.join('; '),
        ...item.claims.map(
          (claim) =>
            claim.kind +
            ': ' +
            claim.text +
            (claim.uncertainty ? '\nОграничение: ' + claim.uncertainty : ''),
        ),
        ...item.evidence.map(
          (e) => 'Источник ' + e.documentId + (e.page ? ', стр. ' + e.page : '') + ': ' + e.quote,
        ),
        ...item.limitations.map((text) => 'Ограничение: ' + text),
        ...(item.dataMode === 'fixture' ? ['Источник данных: тестовый набор'] : []),
      ].join('\n'),
    ),
  ].join('\n')
}
export function exportDigest(items: Insight[], companyName: string, role: Role) {
  const url = URL.createObjectURL(
    new Blob([digestText(items, companyName, role)], { type: 'text/plain;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'alfa-insights-' + role + '.txt'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast.success('Сводка скачана')
}
