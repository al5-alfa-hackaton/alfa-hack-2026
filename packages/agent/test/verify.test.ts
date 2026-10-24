import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages'
import { describe, expect, it } from 'vitest'
import { buildDataContext } from '../src/data/context.js'
import { createFeedFinalizer, parseFeedAnswer, staleBankQuote } from '../src/agent/feed-parser.js'
import { buildTaskPrompt } from '../src/agent/prompts.js'
import { applyVerdicts, collectStatements, evidenceOf, parseVerdicts, userMessagesOf } from '../src/agent/verify.js'
import { bank, fixtureContext, news } from './helpers.js'

const ctx = await fixtureContext()
const newsId = news[0]!.id

const answer = [
  `Событие ${newsId}`,
  'Тип: риск',
  'Главное: Ставка останется высокой. Компания экспортирует сталь в Китай. Признаки: loans. Оговорка: тип ставки неизвестен.',
  'Риск: Процентные расходы могут вырасти. Признаки: loans. Оговорка: тип ставки неизвестен.',
  'Риск: Выручка упадет на 30%. Признаки: revenue. Оговорка: оценка.',
  'Стоит проверить: условия кредитов. Признаки: loans. Оговорка: договоры не раскрыты.',
].join('\n')

describe('проверка ответа', () => {
  it('собирает утверждения по предложениям и пунктам', () => {
    const ids = collectStatements(parseFeedAnswer(answer).events).map((s) => s.id)
    expect(ids).toEqual([`${newsId}|summary|0`, `${newsId}|summary|1`, `${newsId}|inference|0`, `${newsId}|risk|0`, `${newsId}|risk|1`, `${newsId}|action|0`])
  })

  it('принимает только вердикты с известными id', () => {
    const verdicts = parseVerdicts('```json\n[{"id":"a","supported":false,"reason":"нет данных"},{"id":"x","supported":false},{"id":"b","supported":"нет"}]\n```', ['a', 'b'])
    expect(verdicts).toEqual([{ id: 'a', supported: false, reason: 'нет данных' }])
  })

  it('убирает неподтвержденные предложения и пункты, остальное оставляет', () => {
    const result = parseFeedAnswer(answer)
    const checked = applyVerdicts(result, [
      { id: `${newsId}|summary|1`, supported: false, reason: 'направление ВЭД неизвестно' },
      { id: `${newsId}|risk|1`, supported: false, reason: 'числа нет в данных' },
    ])
    const event = checked.events[0]!
    expect(event.summary).toBe('Ставка останется высокой.')
    expect(event.risks.map((r) => r.text)).toEqual(['Процентные расходы могут вырасти.'])
    expect(event.actions).toHaveLength(1)
    expect(checked.issues.filter((i) => i.includes('проверка убрала'))).toHaveLength(2)
  })

  it('вызывает проверку в финализаторе и сохраняет черновик, если проверка упала', async () => {
    const messages: BaseMessage[] = [new HumanMessage('задача'), new ToolMessage({ content: 'профиль', tool_call_id: '1' }), new AIMessage(answer)]
    const state = { messages, steps: 1, toolCalls: 1, executionScope: null, stopReason: 'answered' as const, structured: null }
    const ok = await createFeedFinalizer({
      ctx,
      eventIds: [newsId],
      featureIds: ['loans', 'revenue'],
      verify: async () => new AIMessage(JSON.stringify([{ id: `${newsId}|risk|1`, supported: false, reason: 'числа нет' }])),
    })(state, {})
    const draft = JSON.parse(String(ok.content))
    expect(draft.events[0].risks).toEqual(['Процентные расходы могут вырасти. (тип ставки неизвестен)'])
    expect(draft.verification).toMatchObject({ checked: 6, rejected: [{ id: `${newsId}|risk|1` }] })
    const failed = await createFeedFinalizer({
      ctx,
      eventIds: [newsId],
      featureIds: ['loans', 'revenue'],
      verify: async () => {
        throw new Error('timeout')
      },
    })(state, {})
    const fallback = JSON.parse(String(failed.content))
    expect(fallback.events[0].risks).toHaveLength(2)
    expect(fallback.issues.at(-1)).toContain('проверка ответа не выполнена')
  })

  it('убирает позицию банка из устаревшего прогноза', () => {
    const doc = { ...bank.documents[0]!, id: 'bank_old', note: 'Прогноз ключевой ставки в этом материале (13,5% на конец 2026 г.) устарел.' }
    const stale = buildDataContext(ctx.companies, { documents: [doc], chunks: [] }, news)
    expect(staleBankQuote(stale, 'bank_old', 'Ждем ставку 13,5% на конец года')).not.toBeNull()
    expect(staleBankQuote(stale, 'bank_old', 'Инфляция замедлится')).toBeNull()
    expect(staleBankQuote(stale, 'bank_old', 'Инфляция в 2026 году составит 7,5%')).toBeNull()
    expect(staleBankQuote(stale, 'bank_old', 'Ставка 13,5 % на конец года')).not.toBeNull()
    const old = { ...doc, id: 'bank_2021', note: 'Материал 2021 года; оценки устарели' }
    expect(staleBankQuote(buildDataContext(ctx.companies, { documents: [old], chunks: [] }, news), 'bank_2021', 'Любая цитата')).not.toBeNull()
  })
})

describe('сведения пользователя для проверки', () => {
  it('берет вопрос и прошлые сообщения пользователя из задания', () => {
    const task = buildTaskPrompt({
      mode: 'question',
      question: 'Кредиты 3 млрд, ставка ключевая + 3%',
      conversation: [
        { author: 'user', text: 'Насколько вырастут расходы?' },
        { author: 'assistant', text: 'Какой объем кредитов?' },
      ],
    })
    expect(userMessagesOf([new HumanMessage(task)])).toEqual(['Насколько вырастут расходы?', 'Кредиты 3 млрд, ставка ключевая + 3%'])
  })
})

describe('данные для проверки', () => {
  it('ставит данные компании и банка перед заданием и ограничивает каждый источник', () => {
    const evidence = evidenceOf([
      new HumanMessage('задание '.repeat(10)),
      new ToolMessage({ content: 'новость', tool_call_id: '1', name: 'news_search' }),
      new ToolMessage({ content: 'x'.repeat(10_000), tool_call_id: '2', name: 'bank_search' }),
      new ToolMessage({ content: 'профиль', tool_call_id: '3', name: 'company_profile' }),
    ])
    expect(evidence.indexOf('[company_profile]')).toBeLessThan(evidence.indexOf('[bank_search]'))
    expect(evidence.indexOf('[bank_search]')).toBeLessThan(evidence.indexOf('[news_search]'))
    expect(evidence.indexOf('[news_search]')).toBeLessThan(evidence.indexOf('[human]'))
    expect(evidence.length).toBeLessThan(5_000)
  })
})
