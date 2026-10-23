import { describe, expect, it } from 'vitest'
import {
  checkForm,
  irrelevantAtK,
  listItems,
  ndcgAtK,
  numbersIn,
  overlap,
  precisionAtK,
  sentences,
  unjudged,
  unsupportedNumbers,
} from '../src/eval/metrics.js'

const labels = { a: 2, b: 1, c: 0, d: 2 }

describe('метрики отбора', () => {
  it('precision@k и доля нерелевантных', () => {
    expect(precisionAtK(['a', 'c', 'b'], labels, 3)).toBeCloseTo(2 / 3)
    expect(precisionAtK(['a', 'c', 'b'], labels, 3, 2)).toBeCloseTo(1 / 3)
    expect(irrelevantAtK(['c', 'x', 'a'], labels, 3)).toBeCloseTo(2 / 3)
    expect(precisionAtK([], labels, 3)).toBe(0)
  })

  it('nDCG равен 1 для идеального порядка и падает при перестановке', () => {
    expect(ndcgAtK(['a', 'd', 'b'], labels, 3)).toBeCloseTo(1)
    expect(ndcgAtK(['b', 'd', 'a'], labels, 3)).toBeLessThan(1)
    expect(ndcgAtK(['c', 'x'], labels, 3)).toBe(0)
  })

  it('неразмеченные новости видны отдельно', () => {
    expect(unjudged(['a', 'x', 'y'], labels, 3)).toEqual(['x', 'y'])
  })
})

describe('метрики ответа', () => {
  it('считает предложения без ложных разрывов на числах и сокращениях', () => {
    expect(sentences('Ставка 16.5% давит на маржу. Выручка 3 млн. руб. не изменится! Итог?')).toHaveLength(3)
    expect(sentences('В 2026 г. спрос упал. Это риск.')).toHaveLength(2)
  })

  it('находит пункты списка', () => {
    expect(listItems('Риски:\n1) Ставка.\n2) Спрос.\n- Курс.')).toHaveLength(3)
  })

  it('числа без подтверждения в источниках', () => {
    expect(numbersIn('Рост 1 200 тыс. и 3,5% по news_ab12')).toEqual(['1200', '3.5'])
    expect(unsupportedNumbers('Цена выросла на 7% и 12%', ['Цены выросли на 7%'])).toEqual(['12'])
  })

  it('проверяет форму ответа', () => {
    const shape = (answer: string, clarification: string | null = null, claims = 0) => ({ answer, clarification, claims })
    expect(checkForm(shape('Раз. Два. Три.'), { kind: 'sentences', count: 3 }).ok).toBe(true)
    expect(checkForm(shape('Раз. Два.'), { kind: 'sentences', count: 3 }).ok).toBe(false)
    expect(checkForm(shape('1) Ставка.\n2) Спрос.\n3) Курс.'), { kind: 'list', count: 3 }).ok).toBe(true)
    expect(checkForm(shape('Коротко о главном.'), { kind: 'brief' }).ok).toBe(true)
    expect(checkForm(shape('Привет! Спросите о рисках.'), { kind: 'greeting' }).ok).toBe(true)
    expect(checkForm(shape('Привет!', null, 2), { kind: 'greeting' }).ok).toBe(false)
    expect(checkForm(shape('Нужны данные.', 'Какой объем кредитов?'), { kind: 'clarification' }).ok).toBe(true)
    expect(checkForm(shape('Нужны данные.', 'Какой объем кредитов?'), { kind: 'no_clarification' }).ok).toBe(false)
  })
})

describe('повторы между ответами', () => {
  it('сходство по словам', () => {
    expect(overlap('Рост ставки повышает расходы', 'Рост ставки повышает расходы')).toBe(1)
    expect(overlap('Рост ставки повышает расходы', 'Спрос на жилье падает')).toBe(0)
  })
})
