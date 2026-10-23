import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createFeedFinalizer, parseFeedAnswer, toStructuredDraft } from '../src/agent/feed-parser.js'
import { buildTaskPrompt, clarificationAllowed } from '../src/agent/prompts.js'
import { fixtureContext } from './helpers.js'

const ctx = await fixtureContext()

const backendDraftSchema = z.object({
  events: z
    .array(
      z.object({
        eventId: z.string(),
        claims: z
          .array(
            z.object({
              kind: z.enum(['fact', 'bank_position', 'ai_inference']),
              text: z.string().min(1).max(2000),
              companyFeatureIds: z.array(z.string()).max(10),
              uncertainty: z.string().nullable(),
              citations: z.array(z.object({ documentId: z.string(), quote: z.string().min(12).max(300) })).max(10),
            }),
          )
          .max(15),
      }),
    )
    .max(5),
})

const feedAnswer = `Событие news_rate
Тип: риск
Главное: У компании есть кредиты в Альфа-Банке, поэтому сохранение ставки удерживает дорогим обслуживание долга. Признаки: loans. Оговорка: тип ставки по кредитам неизвестен.
Факт: «Совет директоров Банка России принял решение сохранить ключевую ставку на уровне 14,00% годовых.» [news_rate]
Позиция банка: «Мы ожидаем сохранения ставки до конца года, что поддержит высокую стоимость заемного финансирования.» [bank_test, 2026-09-11]
Риск: Если ставка по кредитам плавающая, процентные расходы не снизятся. Признаки: loans. Оговорка: тип ставки неизвестен.
Стоит проверить: долю кредитов с плавающей ставкой. Признаки: loans. Оговорка: договоры в данных не раскрыты.

- **Событие news_steel**
- **Тип:** возможность
- **Главное:** Рост экспорта стали в Китай поддерживает спрос на продукцию компании. Признаки: industry, customs, unknown_feature. Оговорка: направление внешней торговли неизвестно.
- **Факт:** «Поставки российской стали в Китай увеличились на 12% за квартал.» [news_steel]
- **Возможность:** Экспортный спрос может поддержать загрузку. Признаки: industry. Оговорка: доля экспорта неизвестна.

Событие news_other: пропустить — спор чужих компаний.

Для карточек используй только цитаты, приведенные в блоках выше; другие фрагменты документов не добавляй.`

const featureIds = ['industry', 'loans', 'leasing', 'customs']

describe('feed answer parser', () => {
  it('turns labelled blocks into backend-compatible drafts with card fields', () => {
    const result = parseFeedAnswer(feedAnswer, { ctx, featureIds, eventIds: ['news_rate', 'news_steel', 'news_other'] })
    expect(result.skipped).toEqual([{ eventId: 'news_other', reason: 'спор чужих компаний' }])
    expect(result.events.map((e) => [e.eventId, e.kind])).toEqual([
      ['news_rate', 'risk'],
      ['news_steel', 'opportunity'],
    ])
    const rate = result.events[0]!
    expect(rate.summary).toMatch(/^У компании есть кредиты/)
    expect(rate.claims.map((c) => c.kind)).toEqual(['fact', 'bank_position', 'ai_inference'])
    expect(rate.claims[0]).toMatchObject({ text: rate.claims[0]!.citations[0]!.quote, citations: [{ documentId: 'news_rate' }] })
    expect(rate.risks).toEqual([{ text: 'Если ставка по кредитам плавающая, процентные расходы не снизятся.', companyFeatureIds: ['loans'], uncertainty: 'тип ставки неизвестен' }])
    expect(rate.actions[0]!.text).toBe('долю кредитов с плавающей ставкой.')
    expect(result.events[1]!.claims.find((c) => c.kind === 'ai_inference')!.companyFeatureIds).toEqual(['industry', 'customs'])
    expect(result.issues).toContain('news_steel: признаки unknown_feature неизвестны и убраны')
    expect(() => backendDraftSchema.parse(toStructuredDraft(result))).not.toThrow()
  })

  it('reads the answer line in question mode', () => {
    const result = parseFeedAnswer(
      `Событие news_rate
Ответ: Действовать сейчас не нужно, но стоит проверить ставку по кредитам. Признаки: loans. Оговорка: условия договоров неизвестны.
Факт: «Банк России сохранил ключевую ставку 14%» [news_rate]`,
      { ctx, featureIds },
    )
    expect(result.events[0]).toMatchObject({ answer: 'Действовать сейчас не нужно, но стоит проверить ставку по кредитам.', kind: 'context' })
  })

  it('keeps multi-line list answers and appends clarifying questions', () => {
    const result = parseFeedAnswer(
      `Событие news_rate
Ответ: Проверьте в первую очередь:
1) долю кредитов с плавающей ставкой;
2) ближайшие погашения. Признаки: loans. Оговорка: условия договоров неизвестны.
Уточнение: Какая доля ваших кредитов привязана к ключевой ставке?
Факт: «Банк России сохранил ключевую ставку 14%» [news_rate]`,
      { ctx, featureIds },
    )
    const event = result.events[0]!
    expect(event.answer).toBe('Проверьте в первую очередь:\n1) долю кредитов с плавающей ставкой;\n2) ближайшие погашения.\n\nКакая доля ваших кредитов привязана к ключевой ставке?')
    expect(event.clarification).toBe('Какая доля ваших кредитов привязана к ключевой ставке?')
    expect(event.claims.map((c) => c.kind)).toEqual(['fact', 'ai_inference'])
  })

  it('accepts a short answer without facts for greetings', () => {
    const result = parseFeedAnswer('Событие news_rate\nОтвет: Здравствуйте! Спросите о рисках или действиях по этому событию.', { ctx })
    expect(result.events[0]!.answer).toBe('Здравствуйте! Спросите о рисках или действиях по этому событию.')
    expect(result.issues).toEqual([])
  })

  it('drops invented quotes, foreign events and bank positions from news', () => {
    const result = parseFeedAnswer(
      `Событие news_rate
Факт: «Банк России неожиданно снизил ставку до 10%» [news_rate]
Позиция банка: «Совет директоров Банка России принял решение сохранить ключевую ставку на уровне 14,00% годовых.» [news_rate, 2026-09-11]
Факт: Совет директоров Банка России принял решение сохранить ключевую ставку
Событие news_unknown
Факт: «Поставки российской стали в Китай увеличились на 12% за квартал.» [news_steel]`,
      { ctx, eventIds: ['news_rate'] },
    )
    expect(result.events).toHaveLength(1)
    expect(result.events[0]!.claims).toEqual([])
    expect(result.issues).toEqual([
      'news_rate: цитата не найдена в документе news_rate',
      'news_rate: позиция банка ссылается не на материал банка (news_rate)',
      'news_rate: факт без идентификатора документа',
      'news_unknown: событие не из выбранных сервером, пропущено',
      'news_rate: нет подтвержденного факта из новости — карточка не будет опубликована',
    ])
  })

  it('shortens quotes longer than the backend limit at a sentence boundary', () => {
    const sentence = 'Мы ожидаем сохранения ставки до конца года, что поддержит высокую стоимость заемного финансирования.'
    const long = `${'Ключевая ставка сохранена на уровне 14,0%. '.repeat(6)}${sentence}`
    const page = `${long} Конец страницы.`
    const longCtx = { ...ctx, bank: { ...ctx.bank, documents: [{ ...ctx.bank.documents[0]!, pages: [page] }] } }
    const result = parseFeedAnswer(`Событие news_rate\nПозиция банка: «${long}» [bank_test, 2026-09-11]`, { ctx: longCtx })
    const quote = result.events[0]!.claims[0]!.citations[0]!.quote
    expect(long.length).toBeGreaterThan(300)
    expect(quote.length).toBeLessThanOrEqual(300)
    expect(quote.endsWith('.')).toBe(true)
    expect(page).toContain(quote)
  })

  it('keeps inferences without features out of claims but still exposes the summary', () => {
    const result = parseFeedAnswer('Событие news_rate\nГлавное: Ставка остается высокой.\nФакт: «Банк России сохранил ключевую ставку 14%» [news_rate]', { ctx })
    expect(result.events[0]!.summary).toBe('Ставка остается высокой.')
    expect(result.events[0]!.claims.map((c) => c.kind)).toEqual(['fact'])
  })
})

describe('feed finalizer', () => {
  const state = (text: string) => ({
    messages: [new HumanMessage('задача'), new AIMessage({ content: '', tool_calls: [{ id: '1', name: 'company_profile', args: {} }] }), new AIMessage(text)],
    steps: 2,
    toolCalls: 1,
    executionScope: null,
    structured: null,
    stopReason: 'answered' as const,
  })

  it('returns parsed JSON without a model call', async () => {
    let fallbackCalls = 0
    const finalize = createFeedFinalizer({ ctx, eventIds: ['news_rate', 'news_steel', 'news_other'], featureIds, fallback: async () => (fallbackCalls++, new AIMessage('{"events":[]}')) })
    const message = await finalize(state(feedAnswer), {})
    const json = JSON.parse(String(message.content))
    expect(fallbackCalls).toBe(0)
    expect(json.events.map((e: { eventId: string }) => e.eventId)).toEqual(['news_rate', 'news_steel'])
    expect(json.skipped).toHaveLength(1)
    expect(() => backendDraftSchema.parse(json)).not.toThrow()
  })

  it('drops a clarification when the user has just answered one', () => {
    const text = 'Событие news_rate\nОтвет: Расходы составят около 510 млн руб. в год.\nУточнение: Какой график платежей?'
    expect(parseFeedAnswer(text, { ctx, allowClarification: false }).events[0]!.answer).toBe('Расходы составят около 510 млн руб. в год.')
    expect(clarificationAllowed([{ author: 'assistant', text: 'Какой объем долга?' }, { author: 'user', text: '3 млрд' }])).toBe(false)
    expect(clarificationAllowed([{ author: 'assistant', text: 'Риски такие.' }, { author: 'user', text: 'а что делать?' }])).toBe(true)
    expect(clarificationAllowed([{ author: 'assistant', text: 'Какой объем?' }, { author: 'user', text: '3 млрд' }, { author: 'assistant', text: 'Расходы 510 млн.' }])).toBe(false)
    expect(buildTaskPrompt({ mode: 'question', question: '3 млрд', conversation: [{ author: 'assistant', text: 'Какой объем?' }] })).toContain('Уточнение в этом ответе: запрещено')
  })

  it('turns a plain-text reply into an answer in question mode', async () => {
    const finalize = createFeedFinalizer({ ctx, eventIds: ['news_rate'], featureIds, mode: 'question', fallback: async () => new AIMessage('fallback') })
    const json = JSON.parse(String((await finalize(state('Здравствуйте! Спросите о рисках или действиях по этому событию.'), {})).content))
    expect(json.events[0]).toMatchObject({ eventId: 'news_rate', answer: 'Здравствуйте! Спросите о рисках или действиях по этому событию.' })
  })

  it('falls back to the model when the answer has no recognizable blocks', async () => {
    const finalize = createFeedFinalizer({ ctx, eventIds: ['news_rate'], featureIds, fallback: async () => new AIMessage('fallback') })
    expect((await finalize(state('Свободный текст без разметки.'), {})).content).toBe('fallback')
  })
})

describe('task prompt modes', () => {
  it('separates the user question, card context and conversation in question mode', () => {
    const prompt = buildTaskPrompt({
      mode: 'question',
      question: 'Какие риски?',
      asOf: '2026-10-23',
      events: [{ id: 'news_rate', title: 'Ставка', publishedAt: null }],
      context: { eventId: 'news_rate', summary: 'Кратко' },
      conversation: [{ author: 'assistant', text: 'Прошлый ответ' }],
    })
    expect(prompt).toContain('Режим: вопрос пользователя')
    expect(prompt).toMatch(/<user_question>\nКакие риски\?\n<\/user_question>/)
    expect(prompt).toContain('"summary":"Кратко"')
    expect(prompt).toContain('Прошлый ответ')
    expect(prompt).toContain('Выбранные события')
  })

  it('marks feed mode and keeps the legacy single-question prompt', () => {
    expect(buildTaskPrompt({ mode: 'feed', question: 'Разбери события', events: [] })).toContain('Режим: лента')
    expect(buildTaskPrompt({ question: 'Как ставка влияет на компанию?' })).not.toContain('Режим:')
  })
})
