export type Grades = Record<string, number>

const gradeOf = (labels: Grades, id: string) => labels[id] ?? 0

export function precisionAtK(list: string[], labels: Grades, k: number, minGrade = 1): number {
  const top = list.slice(0, k)
  if (!top.length) return 0
  return top.filter((id) => gradeOf(labels, id) >= minGrade).length / top.length
}

export function irrelevantAtK(list: string[], labels: Grades, k: number): number {
  const top = list.slice(0, k)
  if (!top.length) return 0
  return top.filter((id) => gradeOf(labels, id) === 0).length / top.length
}

function dcg(grades: number[]): number {
  return grades.reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0)
}

export function ndcgAtK(list: string[], labels: Grades, k: number): number {
  const ideal = dcg(
    Object.values(labels)
      .sort((a, b) => b - a)
      .slice(0, k),
  )
  return ideal ? dcg(list.slice(0, k).map((id) => gradeOf(labels, id))) / ideal : 0
}

export function unjudged(list: string[], labels: Grades, k: number): string[] {
  return list.slice(0, k).filter((id) => !(id in labels))
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

export function sentences(text: string): string[] {
  return text
    .replace(/\n+\s*\d+[).]\s+/g, '\n')
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/(?<![а-яё])(?:т\.\s?е|т\.\s?к|т\.\s?д|т\.\s?п|г|гг|млн|млрд|трлн|руб|тыс|см|ст)\.(?=\s+[а-яё\d])/g, (m) => m.replace(/\./g, '·'))
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[а-яёa-z]/i.test(s))
}

export function listItems(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(?:\d+[).]|[-•–—*])\s+\S/.test(l))
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[а-яёa-z0-9]/i.test(w)).length
}

const NUMBER = /\d+(?:[.,]\d+)?/g

function normalizeNumber(raw: string): string {
  return raw.replace(',', '.').replace(/\.0+$/, '')
}

export function numbersIn(text: string): string[] {
  const cleaned = text.replace(/\b(?:news|bank)_[0-9a-z_]+/gi, ' ').replace(/(\d)\s(?=\d{3}\b)/g, '$1')
  return [...cleaned.matchAll(NUMBER)].map((m) => normalizeNumber(m[0]))
}

export function unsupportedNumbers(answer: string, sources: string[], ignore: (n: string) => boolean = () => false): string[] {
  const known = new Set(sources.flatMap(numbersIn))
  return [...new Set(numbersIn(answer))].filter((n) => !known.has(n) && !ignore(n))
}

export type FormExpectation =
  | { kind: 'sentences'; count: number }
  | { kind: 'list'; count: number }
  | { kind: 'brief' }
  | { kind: 'greeting' }
  | { kind: 'clarification' }
  | { kind: 'no_clarification' }
  | { kind: 'free' }

export type AnswerShape = { answer: string; clarification: string | null; claims: number }

export function checkForm(shape: AnswerShape, expect: FormExpectation): { ok: boolean; detail: string } {
  const body = shape.answer.replace(/\s*Признаки:.*$/gm, '').trim()
  const n = sentences(body).length
  const items = listItems(body).length
  switch (expect.kind) {
    case 'sentences':
      return { ok: n === expect.count, detail: `предложений ${n}, нужно ${expect.count}` }
    case 'list':
      return { ok: items === expect.count, detail: `пунктов ${items}, нужно ${expect.count}` }
    case 'brief':
      return { ok: n <= 2 && wordCount(body) <= 45, detail: `предложений ${n}, слов ${wordCount(body)}` }
    case 'greeting':
      return { ok: n <= 3 && shape.claims === 0 && !shape.clarification, detail: `предложений ${n}, утверждений ${shape.claims}` }
    case 'clarification':
      return { ok: Boolean(shape.clarification), detail: shape.clarification ? 'уточнение задано' : 'нет уточнения' }
    case 'no_clarification':
      return { ok: !shape.clarification, detail: shape.clarification ? 'повторное уточнение' : 'без уточнения' }
    case 'free':
      return { ok: body.length > 0, detail: body.length ? 'ответ есть' : 'пустой ответ' }
  }
}

export function overlap(a: string, b: string): number {
  const words = (t: string) => new Set(t.toLowerCase().match(/[а-яёa-z]{4,}/g) ?? [])
  const x = words(a)
  const y = words(b)
  const common = [...x].filter((w) => y.has(w)).length
  return x.size + y.size - common ? common / (x.size + y.size - common) : 0
}
