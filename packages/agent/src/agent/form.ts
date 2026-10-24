import { listItems, wordCount } from '../eval/metrics.js'

export type AnswerForm = { kind: 'brief' } | { kind: 'sentences'; count: number } | { kind: 'list'; count: number }

const NUMBERS: Record<string, number> = { одн: 1, дв: 2, тр: 3, четыр: 4, пят: 5, шест: 6, сем: 7 }
const BRIEF_WORDS = 45

function count(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word)
  const stem = Object.keys(NUMBERS).find((s) => word.toLowerCase().startsWith(s))
  return stem ? NUMBERS[stem]! : null
}

export function answerForm(question: string): AnswerForm | null {
  const q = question.toLowerCase()
  const inSentences = q.match(/в\s+(\S+)\s+предложени/)
  if (inSentences) {
    const n = count(inSentences[1]!)
    if (n) return { kind: 'sentences', count: n }
  }
  const list = q.match(/(\S+)\s+(?:риск\S*|пункт\S*|шаг\S*|причин\S*|действи\S*|возможност\S*)\s+(?:списком|по пунктам)|(?:списком|по пунктам)/)
  if (list) {
    const n = list[1] ? count(list[1]) : null
    if (n) return { kind: 'list', count: n }
  }
  if (/(?:^|\s)(?:кратко|коротко|в двух словах|вкратце)(?:\s|$|[.,!?])/.test(q)) return { kind: 'brief' }
  return null
}

export function isSmallTalk(question: string): boolean {
  const q = question.trim().toLowerCase().replace(/[!?.,)]+$/g, '')
  return q.split(/\s+/).length <= 4 && /^(?:привет|здравствуй\S*|добр\S+ (?:день|утро|вечер)|доброе утро|хай|hello|hi|спасибо|благодарю|ок|понятно)(?:\s|$)/.test(q)
}

function splitSentences(text: string): string[] {
  const masked = text
    .replace(/(\d)\.(\d)/g, '$1·$2')
    .replace(/(?<![а-яё])(?:т\.\s?е|т\.\s?к|т\.\s?д|т\.\s?п|г|гг|млн|млрд|трлн|руб|тыс|см|ст)\.(?=\s+[а-яё\d])/g, (m) => m.replace(/\./g, '·'))
  const parts: string[] = []
  let start = 0
  for (const m of masked.matchAll(/(?<=[.!?…])\s+|\n+/g)) {
    parts.push(text.slice(start, m.index))
    start = m.index! + m[0].length
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter((p) => /[а-яёa-z]/i.test(p))
}

export function enforceForm(text: string, form: AnswerForm | null): string {
  if (!form) return text
  if (form.kind === 'list') {
    const items = listItems(text)
    if (items.length <= form.count) return text
    const lines = text.split('\n')
    let seen = 0
    return lines.filter((l) => !items.includes(l.trim()) || ++seen <= form.count).join('\n').trim()
  }
  if (listItems(text).length) return text
  const parts = splitSentences(text)
  const limit = form.kind === 'sentences' ? form.count : 2
  if (form.kind === 'sentences' && parts.length <= limit) return text
  if (form.kind === 'brief' && parts.length <= limit && wordCount(text) <= BRIEF_WORDS) return text
  const kept: string[] = []
  for (const s of parts) {
    if (kept.length >= limit) break
    if (form.kind === 'brief' && kept.length && wordCount([...kept, s].join(' ')) > BRIEF_WORDS) break
    kept.push(s)
  }
  return kept.join(' ')
}
