import { NEWS_SOURCES } from '../data/news.js'
import { stripHtml } from '../data/text.js'

const MAX_ARTICLE_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 3
const MIN_PARAGRAPH = 40
const BOILERPLATE = /подписывайтесь|подпишитесь|читайте также|читайте рекомендации|реклама|файлы cookie|все права защищены/i
const ARTICLE_TYPES = new Set(['NewsArticle', 'Article', 'ReportageNewsArticle', 'AnalysisNewsArticle', 'BlogPosting'])

function registrableDomain(host: string): string {
  return host.split('.').slice(-2).join('.')
}

export const ARTICLE_DOMAINS = new Set(NEWS_SOURCES.map((s) => registrableDomain(new URL(s.url).host)))

export function isAllowedArticleUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false
  const domain = registrableDomain(url.host)
  return ARTICLE_DOMAINS.has(domain) && (url.host === domain || url.host.endsWith(`.${domain}`))
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
}

function clean(text: string): string {
  return decodeEntities(stripHtml(text)).replace(/\s+/g, ' ').trim()
}

function* jsonLdNodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) for (const v of value) yield* jsonLdNodes(v)
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    yield node
    if (node['@graph']) yield* jsonLdNodes(node['@graph'])
  }
}

function fromJsonLd(html: string): string | null {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(match[1]!.trim())
    } catch {
      continue
    }
    for (const node of jsonLdNodes(data)) {
      const types = [node['@type']].flat()
      if (!types.some((t) => typeof t === 'string' && ARTICLE_TYPES.has(t))) continue
      if (typeof node.articleBody === 'string' && node.articleBody.trim()) return clean(node.articleBody)
    }
  }
  return null
}

const PARAGRAPH = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
const TEXT_DIV = /<div\b[^>]*class=["'][^"']*\b(?:article__text|article-text|doc__text|text-block|news-text|article__body)\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi

function blockText(scope: string): string {
  const parts: { at: number; text: string }[] = []
  for (const re of [PARAGRAPH, TEXT_DIV])
    for (const m of scope.matchAll(re)) {
      const text = clean(m[1]!)
      if (text.length >= MIN_PARAGRAPH && !BOILERPLATE.test(text)) parts.push({ at: m.index ?? 0, text })
    }
  return [...new Set(parts.sort((a, b) => a.at - b.at).map((p) => p.text))].join('\n')
}

function fromParagraphs(html: string): string | null {
  const withoutNoise = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ')
  const scopes = [...withoutNoise.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((m) => m[0])
  const candidates = [...scopes, withoutNoise].map(blockText)
  const best = scopes.length ? candidates.slice(0, -1).reduce((a, b) => (b.length > a.length ? b : a), '') : candidates.at(-1)!
  const text = best || candidates.at(-1)!
  return text ? text : null
}

const TAIL_MARKERS = /(?:Читать по теме|Читайте также|Смотрите также|Новости по теме|Подписываясь, вы даете согласие)/
const POINTER = new RegExp(
  [
    '^(?:Подробнее|Подробности|Более подробно|Подробно об\\S*|Подробная информация|Полный текст|Читайте|Смотрите)(?:\\s|$|[—:,])',
    '^(?:Откройте|Оформите|Оформляйте|Подберите|Получите|Сравните|Выберите)\\s',
    '^\\S+(?:йте|ите)\\s.*Банки\\.ру',
    '\\sБанки\\.ру$',
    '^Оставайтесь на связи',
    '«Макс[а-я]*»\\.?$',
    '^За оформление\\s.*Банки\\.ру',
    '^Условия по каждому\\s',
    '^(?:Подписывайтесь|Следите за)\\s',
    '\\sздесь\\s?\\.?$',
    '\\sв статье:$',
    '^[.\\s]*$',
  ].join('|'),
)

function sentences(line: string): string[] {
  return line.split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«"])/)
}

export function trimArticleText(text: string): string {
  const marker = text.search(TAIL_MARKERS)
  const body = marker >= 0 ? text.slice(0, marker) : text
  return body
    .split('\n')
    .map((line) => sentences(line.trim()).filter((s) => !POINTER.test(s.trim())).join(' ').trim())
    .filter((line, i, lines) => line && line !== lines[i - 1])
    .join('\n')
    .trim()
}

export function extractArticleText(html: string): { text: string; method: 'json-ld' | 'paragraphs' } | null {
  const ld = fromJsonLd(html)
  if (ld) return { text: trimArticleText(ld), method: 'json-ld' }
  const p = fromParagraphs(html)
  return p ? { text: trimArticleText(p), method: 'paragraphs' } : null
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_ARTICLE_BYTES) {
      await reader.cancel()
      throw new Error('article too large')
    }
    chunks.push(value)
  }
  const charset = response.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8'
  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charset)
  } catch {
    decoder = new TextDecoder('utf-8')
  }
  return decoder.decode(Buffer.concat(chunks))
}

export async function fetchArticleHtml(rawUrl: string, signal?: AbortSignal): Promise<string> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedArticleUrl(url)) throw new Error(`host not allowed: ${url.host}`)
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': 'alfa-hack-research/0.1', accept: 'text/html' },
    })
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return readLimited(response)
  }
  throw new Error('too many redirects')
}
