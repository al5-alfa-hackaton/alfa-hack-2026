import { createReadStream } from 'node:fs'
import { parse } from 'csv-parse'

export async function* readCsv(path: string): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(path).pipe(
    parse({ delimiter: ';', columns: true, bom: true, relax_quotes: true, skip_empty_lines: true, trim: true }),
  )
  for await (const record of parser) yield record as Record<string, string>
}

export function parseFlag(value: string | undefined): boolean | null {
  if (value === undefined || value === '') return null
  const n = Number(value)
  if (n === 1) return true
  if (n === 0) return false
  return null
}

export function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value
}
