import { describe, expect, it } from 'vitest'
import { parseFeedAnswer, shapeAnswers } from '../src/agent/feed-parser.js'
import { answerForm, enforceForm, isSmallTalk } from '../src/agent/form.js'
import { clarificationAllowed } from '../src/agent/prompts.js'

describe('форма ответа', () => {
  it('определяет форму по вопросу', () => {
    expect(answerForm('Расскажи в 3 предложениях')).toEqual({ kind: 'sentences', count: 3 })
    expect(answerForm('объясни в двух предложениях')).toEqual({ kind: 'sentences', count: 2 })
    expect(answerForm('Назови 3 риска списком')).toEqual({ kind: 'list', count: 3 })
    expect(answerForm('Расскажи кратко')).toEqual({ kind: 'brief' })
    expect(answerForm('Какие риски?')).toBeNull()
  })

  it('обрезает лишние предложения, не меняя текст', () => {
    expect(enforceForm('Ставка 14,5% давит на маржу. Спрос падает. Курс растет. Итог неясен.', { kind: 'sentences', count: 3 })).toBe('Ставка 14,5% давит на маржу. Спрос падает. Курс растет.')
    expect(enforceForm('Раз. Два.', { kind: 'sentences', count: 3 })).toBe('Раз. Два.')
    const long = 'Скидки застройщиков бьют по выручке компании и по стоимости долга одновременно, потому что поступления падают. ' + 'Слово '.repeat(40).trim() + '. Третье предложение.'
    const brief = enforceForm(long, { kind: 'brief' })
    expect(brief).toBe('Скидки застройщиков бьют по выручке компании и по стоимости долга одновременно, потому что поступления падают.')
    expect(enforceForm('1) Ставка.\n2) Спрос.\n3) Курс.\n4) Налоги.', { kind: 'list', count: 3 })).toBe('1) Ставка.\n2) Спрос.\n3) Курс.')
  })

  it('не задает уточнение на приветствие и благодарность', () => {
    expect(isSmallTalk('Привет!')).toBe(true)
    expect(isSmallTalk('Спасибо')).toBe(true)
    expect(isSmallTalk('Привет, какие риски по кредитам у нас будут в следующем году?')).toBe(false)
    expect(clarificationAllowed([], 'Привет!')).toBe(false)
    expect(clarificationAllowed([], 'Насколько вырастут расходы?')).toBe(true)
  })
})

describe('ответ на приветствие', () => {
  it('оставляет одну-две фразы без фактов и уточнения', () => {
    const text = ['Событие news_a', 'Ответ: Привет! Могу разобрать риски. Спросите о ставке. Или о спросе.', 'Уточнение: Какая у вас выручка?', 'Факт: «Ставка сохранена на уровне 14%» [news_a]'].join('\n')
    const [event] = shapeAnswers(parseFeedAnswer(text, { mode: 'question' }), 'Привет!').events
    expect(event!.answer).toBe('Привет! Могу разобрать риски.')
    expect(event!.claims).toHaveLength(0)
    expect(event!.clarification).toBeNull()
  })
})
