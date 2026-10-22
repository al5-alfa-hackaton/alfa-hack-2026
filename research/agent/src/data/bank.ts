import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { extractImages, extractText, getDocumentProxy } from 'unpdf'
import { BANK_CATALOG } from './bank-catalog.js'
import { encodePng } from './png.js'

export type BankDocument = {
  id: string
  file: string
  title: string
  publishedAt: string | null
  note?: string
  sha256: string
  textSource: 'pdf' | 'ocr' | 'none'
  pages: string[]
}

export type BankChunk = {
  id: string
  documentId: string
  title: string
  publishedAt: string | null
  page: number
  start: number
  end: number
  text: string
}

export type BankCorpus = { documents: BankDocument[]; chunks: BankChunk[] }

export type BankOcr = { documentId: string; file: string; model: string; createdAt: string; pages: string[] }

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 200

export function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function chunkPage(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK_SIZE)
    if (end < text.length) {
      const boundary = text.lastIndexOf('. ', end)
      if (boundary > start + CHUNK_SIZE / 2) end = boundary + 1
    }
    spans.push({ start, end })
    if (end >= text.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }
  return spans
}

async function listPdfs(pdfDir: string) {
  return (await readdir(pdfDir)).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
}

async function openPdf(path: string) {
  const buffer = await readFile(path)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  return { pdf: await getDocumentProxy(new Uint8Array(buffer)), sha256, id: `bank_${sha256.slice(0, 12)}` }
}

export async function exportPageImages(pdfDir: string, outDir: string) {
  const exported: { documentId: string; file: string; pages: string[] }[] = []
  for (const file of await listPdfs(pdfDir)) {
    const { pdf, id } = await openPdf(join(pdfDir, file))
    const dir = join(outDir, id)
    await mkdir(dir, { recursive: true })
    const pages: string[] = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const path = join(dir, `p${String(p).padStart(2, '0')}.png`)
      if (!existsSync(path)) {
        const [image] = await extractImages(pdf, p)
        if (!image) continue
        await writeFile(path, encodePng(image.data, image.width, image.height, image.channels as 1 | 3 | 4))
      }
      pages.push(path)
    }
    exported.push({ documentId: id, file, pages })
  }
  return exported
}

export async function extractBankCorpus(pdfDir: string, ocrDir: string): Promise<BankCorpus> {
  const documents: BankDocument[] = []
  const chunks: BankChunk[] = []

  for (const file of await listPdfs(pdfDir)) {
    const { pdf, sha256, id } = await openPdf(join(pdfDir, file))
    const { text } = await extractText(pdf, { mergePages: false })
    let pages = text.map(normalizePageText)
    let textSource: BankDocument['textSource'] = pages.some((p) => p.length > 0) ? 'pdf' : 'none'

    const ocrPath = join(ocrDir, `${id}.json`)
    if (textSource === 'none' && existsSync(ocrPath)) {
      const ocr = JSON.parse(await readFile(ocrPath, 'utf8')) as BankOcr
      pages = ocr.pages.map(normalizePageText)
      textSource = 'ocr'
    }

    const catalog = BANK_CATALOG[basename(file)]
    const firstLine = pages.find((p) => p.length > 0)?.slice(0, 160) ?? ''
    const document: BankDocument = {
      id,
      file: basename(file),
      title: catalog?.title ?? (firstLine || file),
      publishedAt: catalog?.publishedAt ?? null,
      ...(catalog?.note ? { note: catalog.note } : {}),
      sha256,
      textSource,
      pages,
    }
    documents.push(document)

    pages.forEach((pageText, i) => {
      for (const span of chunkPage(pageText)) {
        chunks.push({
          id: `${id}_p${i + 1}_${span.start}`,
          documentId: id,
          title: document.title,
          publishedAt: document.publishedAt,
          page: i + 1,
          start: span.start,
          end: span.end,
          text: pageText.slice(span.start, span.end),
        })
      }
    })
  }
  return { documents, chunks }
}
