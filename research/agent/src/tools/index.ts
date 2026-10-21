import type { RunnableConfig } from '@langchain/core/runnables'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import type { DataContext } from '../data/context.js'
import { NEWS_SOURCES } from '../data/news.js'
import {
  bankSearch,
  companyCounterparties,
  companyGroup,
  companyProfile,
  documentRead,
  evidenceVerify,
  newsSearch,
  ToolError,
} from './functions.js'

export type ToolCallRecord = {
  tool: string
  args: unknown
  ok: boolean
  error?: string
  durationMs: number
  resultChars: number
  at: string
}

export type RunScope = { companyId: string }

function scopeOf(config: RunnableConfig | undefined): RunScope {
  const companyId = config?.configurable?.companyId
  if (typeof companyId !== 'string' || !companyId) throw new ToolError('Run scope is missing companyId')
  return { companyId }
}

export function createTools(ctx: DataContext, audit: ToolCallRecord[] = []) {
  function audited<A>(name: string, run: (args: A, scope: RunScope) => unknown) {
    return async (args: A, config?: RunnableConfig) => {
      const started = Date.now()
      try {
        const result = JSON.stringify(run(args, scopeOf(config)))
        audit.push({ tool: name, args, ok: true, durationMs: Date.now() - started, resultChars: result.length, at: new Date(started).toISOString() })
        return result
      } catch (error) {
        if (!(error instanceof ToolError)) throw error
        audit.push({ tool: name, args, ok: false, error: error.message, durationMs: Date.now() - started, resultChars: 0, at: new Date(started).toISOString() })
        return JSON.stringify({ error: error.message })
      }
    }
  }

  return [
    tool(audited('company_profile', (_: object, s) => companyProfile(ctx, s.companyId)), {
      name: 'company_profile',
      description:
        'Когда: первым шагом любого анализа. Что возвращает: ОКВЭД, выручку за 2025 год в рублях, масштаб (по выручке группы, если она известна), регион, возраст и стадию развития, продукты Альфа-Банка (РКО, кредиты, лизинг, гарантии, факторинг, депозиты, зарплатный проект), наличие ВЭД и страны по данным ФТС, пропуски данных. Ограничения: продукты отражают только отношения с Альфа-Банком; масштаб — оценка, а не сегмент банка. Компания задана контекстом запуска, аргументы не нужны.',
      schema: z.object({}),
    }),
    tool(audited('company_group', (a: { limit?: number }, s) => companyGroup(ctx, s.companyId, a.limit)), {
      name: 'company_group',
      description:
        'Когда: событие может затронуть группу целиком или смежные отрасли участников группы. Что возвращает: размер и суммарную выручку группы (GROUP_ID), распределение участников по разделам ОКВЭД, крупнейших участников, компании, связанные через общих обезличенных физлиц. Ограничения: связь через физлицо — сигнал аффилированности, не доказательство контроля.',
      schema: z.object({ limit: z.number().int().min(1).max(50).optional().describe('Сколько участников вернуть') }),
    }),
    tool(
      audited('company_counterparties', (a: { direction?: 'suppliers' | 'customers' | 'both'; limit?: number }, s) =>
        companyCounterparties(ctx, s.companyId, a.direction, a.limit),
      ),
      {
        name: 'company_counterparties',
        description:
          'Когда: событие касается цепочек поставок, цен на сырье, спроса покупателей или отраслей-партнеров. Что возвращает: поставщиков (кому платит компания) и покупателей (кто платит компании), концентрацию (доли топ-1 и топ-5), отрасли контрагентов по доле объема, долю объема контрагентов без профиля, объем относительно годовой выручки (shareOfRevenue), признак industriesReliable, самоплатежи отдельно. Ограничения: только платежи через Альфа-Банк с 1 января; если industriesReliable=false, отрасли контрагентов не характеризуют компанию; объем платежей — сигнал связи, а не мера зависимости.',
        schema: z.object({
          direction: z.enum(['suppliers', 'customers', 'both']).optional(),
          limit: z.number().int().min(1).max(30).optional(),
        }),
      },
    ),
    tool(
      audited('news_search', (a: { query: string; since?: string; until?: string; sourceIds?: string[]; limit?: number }) =>
        newsSearch(ctx, a.query, a),
      ),
      {
        name: 'news_search',
        description: `Когда: нужно найти факты о событии — что произошло, когда, с какими цифрами. Как: запрос из 2–6 ключевых слов на русском; при слабых результатах переформулируй. Что возвращает: documentId, источник, заголовок, дату, ссылку и начало текста. Источники: ${NEWS_SOURCES.map((s) => `${s.id} (${s.name})`).join(', ')}. Ограничения: у большинства источников доступен только лид новости.`,
        schema: z.object({
          query: z.string().min(2).describe('Ключевые слова на русском'),
          since: z.string().optional().describe('ISO дата, не раньше'),
          until: z.string().optional().describe('ISO дата, не позже'),
          sourceIds: z.array(z.string()).optional(),
          limit: z.number().int().min(1).max(20).optional(),
        }),
      },
    ),
    tool(audited('bank_search', (a: { query: string; limit?: number }) => bankSearch(ctx, a.query, a.limit)), {
      name: 'bank_search',
      description:
        'Когда: нужна позиция или прогноз Альфа-Банка по каналу влияния (ключевая ставка, инфляция, ВВП, рынок труда, облигации, сырье, золото, потребление). Как: ищи по теме канала, а не по заголовку новости. Что возвращает: documentId, название материала, дату публикации, страницу и фрагмент текста. Ограничения: это единственный допустимый источник позиции банка; прогнозы банка менялись со временем — при расхождении опирайся на более свежий материал и указывай дату.',
      schema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(10).optional() }),
    }),
    tool(
      audited('document_read', (a: { documentId: string; page?: number; offset?: number; length?: number }) =>
        documentRead(ctx, a.documentId, a),
      ),
      {
        name: 'document_read',
        description: 'Когда: фрагмента из поиска недостаточно для точной цитаты или понимания контекста. Что возвращает: текст новости или страницы материала банка (до 4000 символов за вызов) и общую длину для постраничного чтения. Для материалов банка укажи page.',
        schema: z.object({
          documentId: z.string(),
          page: z.number().int().min(1).optional().describe('Только для материалов банка'),
          offset: z.number().int().min(0).optional(),
          length: z.number().int().min(100).max(4000).optional(),
        }),
      },
    ),
    tool(audited('evidence_verify', (a: { items: { documentId: string; quote: string }[] }) => evidenceVerify(ctx, a.items)), {
      name: 'evidence_verify',
      description: 'Когда: перед ответом, для каждой цитаты из новости или материала банка, на которую опирается ответ. Что возвращает: для каждой цитаты verified=true/false и страницу; при false — причину. Цитата должна быть дословной (15–300 символов); регистр и пробелы не важны.',
      schema: z.object({
        items: z.array(z.object({ documentId: z.string(), quote: z.string() })).min(1).max(20),
      }),
    }),
  ]
}
