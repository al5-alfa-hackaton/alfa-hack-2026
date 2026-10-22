import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { NewsItem } from './news.js'

export async function readJsonNews(path: string): Promise<NewsItem[]> {
  return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as NewsItem[]) : []
}
