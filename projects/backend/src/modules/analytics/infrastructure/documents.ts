import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { DataContext } from '@alfa/agent'
import { AppError, type Principal } from '../../../shared/kernel/errors.js'
import type { Documents } from '../application/documents.js'
import type { PostgresStore } from './postgres-store.js'
import { insights } from '../../../infrastructure/database/schema.js'
import { and, inArray, sql } from 'drizzle-orm'
export class ResearchDocuments implements Documents {
  constructor(
    private readonly ctx: DataContext,
    private readonly store: PostgresStore,
    private readonly dataDir?: string,
  ) {}
  private async authorize(p: Principal, id: string) {
    if (!p.companyIds.length) throw new AppError('not_found', 'Документ недоступен')
    const [match] = await this.store.db
      .select({ id: insights.id })
      .from(insights)
      .where(
        and(
          inArray(insights.companyId, [...p.companyIds]),
          sql`${insights.data}->'evidence' @> ${JSON.stringify([{ documentId: id }])}::jsonb`,
        ),
      )
      .limit(1)
    if (!match) throw new AppError('not_found', 'Документ недоступен')
  }
  async read(p: Principal, id: string, page: number, offset: number, length: number) {
    await this.authorize(p, id)
    const bank = this.ctx.bank.documents.find((d) => d.id === id),
      news = this.ctx.news.find((d) => d.id === id)
    const content = bank?.pages[page - 1] ?? (page === 1 ? news?.text : undefined)
    if (content === undefined) throw new AppError('not_found', 'Страница недоступна')
    const url = news?.url?.startsWith('https://') ? news.url : null
    return {
      documentId: id,
      title: bank?.title ?? news!.title,
      publishedAt: bank?.publishedAt ?? news?.publishedAt ?? null,
      sourceKind: bank ? ('bank' as const) : ('news' as const),
      contentExtent: bank ? ('page' as const) : news?.textSource === 'article' ? ('full_text' as const) : ('lead' as const),
      page,
      offset,
      totalLength: content.length,
      text: content.slice(offset, offset + length),
      externalUrl: url,
    }
  }
  async image(p: Principal, id: string, page: number) {
    await this.authorize(p, id)
    if (
      !this.dataDir ||
      !/^bank_[a-f0-9]{12}$/.test(id) ||
      !this.ctx.bank.documents.some((d) => d.id === id && page <= d.pages.length)
    )
      throw new AppError('not_found', 'Изображение недоступно')
    const root = resolve(this.dataDir, 'processed', 'bank-pages')
    const path = join(root, id, `p${String(page).padStart(2, '0')}.png`)
    try {
      return await readFile(path)
    } catch {
      throw new AppError('not_found', 'Изображение недоступно')
    }
  }
}
