import { join } from 'node:path'
import type { DataContext } from '../data/context.js'
import { normalizeForMatch } from '../data/text.js'

const key = (text: string) => normalizeForMatch(text).replace(/"/g, '')

export type SourceLocation = { label: string; where: string[] }

export function locateSources(answer: string, ctx: DataContext, paths: { bankPdfDir: string; bankPages: string }): SourceLocation[] {
  const line = answer.split('\n').find((l) => l.trim().startsWith('Источники:'))
  if (!line) return []
  return line
    .replace(/^\s*Источники:\s*/, '')
    .split(/;\s*|(?=\[\d+\])/)
    .map((entry) => entry.trim().replace(/[;.]$/, ''))
    .filter(Boolean)
    .map((entry) => {
      const k = key(entry)
      const doc = ctx.bank.documents.find((d) => k.includes(key(d.title).slice(0, 40)))
      if (doc) {
        const pages = [...(entry.match(/стр\.\s*([\d,\s–-]+)/)?.[1]?.matchAll(/\d+/g) ?? [])].map((m) => Number(m[0]))
        return {
          label: entry,
          where: [
            join(paths.bankPdfDir, doc.file),
            ...pages.map((p) => join(paths.bankPages, doc.id, `p${String(p).padStart(2, '0')}.png`)),
          ],
        }
      }
      const news = ctx.news.find((n) => k.includes(key(n.title).slice(0, 40)))
      return { label: entry, where: news ? [news.url] : ['не удалось сопоставить с документом'] }
    })
}
