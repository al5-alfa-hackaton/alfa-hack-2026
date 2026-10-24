import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { buildNewsTagPrompt, NEWS_TAG_PROMPT_VERSION, NEWS_TOPICS } from '../agent/prompts.js'
import type { CompanyStore } from '../data/companies.js'
import type { NewsItem } from '../data/news.js'
import { costOf } from '../llm.js'
import { textOf } from '../agent/graph.js'

export const TOPIC_IDS = Object.keys(NEWS_TOPICS) as (keyof typeof NEWS_TOPICS)[]
export type Topic = (typeof TOPIC_IDS)[number]

export type NewsTag = {
  divisions: string[]
  topics: Topic[]
  scope: 'macro' | 'sector' | 'company' | 'other'
  materiality: 0 | 1 | 2 | 3
}
export type NewsTagFile = { promptVersion: string; model: string; updatedAt: string; tags: Record<string, NewsTag> }
export type NewsTags = Map<string, NewsTag>

const rawTag = z.object({
  id: z.string(),
  divisions: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  scope: z.enum(['macro', 'sector', 'company', 'other']),
  materiality: z.coerce.number().int().min(0).max(3),
})

export const FINE_OKVED_GROUPS = new Set(['35.1', '46.3', '46.4', '46.7', '47.5', '47.7'])

export function okvedGroup(okvedCode: string | null | undefined): string | null {
  const m = okvedCode?.match(/^(\d{2})(?:\.(\d)(\d)?)?/)
  if (!m) return null
  if (!m[2]) return m[1]!
  const group = `${m[1]}.${m[2]}`
  return m[3] && FINE_OKVED_GROUPS.has(group) ? `${group}${m[3]}` : group
}

export function sameIndustry(a: string, b: string): boolean {
  const x = a.replace('.', '')
  const y = b.replace('.', '')
  return x.startsWith(y) || y.startsWith(x)
}

export function okvedDivisions(store: CompanyStore, perDivision = 1): { code: string; name: string }[] {
  const names = new Map<string, Map<string, number>>()
  for (const rows of store.companies.values()) {
    const c = rows[0]
    const code = okvedGroup(c?.okvedCode)
    if (!code || !c?.okvedName) continue
    const counts = names.get(code) ?? new Map<string, number>()
    counts.set(c.okvedName, (counts.get(c.okvedName) ?? 0) + 1)
    names.set(code, counts)
  }
  return [...names]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, counts]) => ({
      code,
      name: [...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, perDivision)
        .map(([n]) => n.slice(0, 70))
        .join('; '),
    }))
}

export function parseTagResponse(text: string, expectedIds: string[], divisionCodes: Set<string>): Map<string, NewsTag> {
  const json = text.replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/, '$1')
  let items: unknown
  try {
    items = JSON.parse(json)
  } catch {
    return new Map()
  }
  if (!Array.isArray(items)) return new Map()
  const expected = new Set(expectedIds)
  const tags = new Map<string, NewsTag>()
  for (const item of items) {
    const parsed = rawTag.safeParse(item)
    if (!parsed.success || !expected.has(parsed.data.id)) continue
    const t = parsed.data
    tags.set(t.id, {
      divisions: [
        ...new Set(
          t.divisions
            .map((d) => okvedGroup(d.trim()))
            .filter((d): d is string => d !== null && [...divisionCodes].some((c) => c.replace('.', '').startsWith(d.replace('.', '')))),
        ),
      ].slice(0, 5),
      topics: [...new Set(t.topics.filter((x): x is Topic => (TOPIC_IDS as string[]).includes(x)))].slice(0, 4),
      scope: t.scope,
      materiality: t.materiality as NewsTag['materiality'],
    })
  }
  return tags
}

export async function tagNewsBatch(
  model: BaseChatModel,
  divisions: { code: string; name: string }[],
  items: NewsItem[],
): Promise<{ tags: Map<string, NewsTag>; cost: number }> {
  const response = await model.invoke([new HumanMessage(buildNewsTagPrompt(divisions, items))])
  const tags = parseTagResponse(
    textOf(response),
    items.map((n) => n.id),
    new Set(divisions.map((d) => d.code)),
  )
  return { tags, cost: costOf(response) }
}

export async function readNewsTags(path: string): Promise<NewsTagFile | null> {
  if (!existsSync(path)) return null
  return JSON.parse(await readFile(path, 'utf8')) as NewsTagFile
}

export async function loadNewsTags(path: string): Promise<NewsTags> {
  const file = await readNewsTags(path)
  return new Map(file && file.promptVersion === NEWS_TAG_PROMPT_VERSION ? Object.entries(file.tags) : [])
}

export async function writeNewsTags(path: string, model: string, tags: NewsTags) {
  const file: NewsTagFile = {
    promptVersion: NEWS_TAG_PROMPT_VERSION,
    model,
    updatedAt: new Date().toISOString(),
    tags: Object.fromEntries(tags),
  }
  await writeFile(path, JSON.stringify(file, null, 1))
}
