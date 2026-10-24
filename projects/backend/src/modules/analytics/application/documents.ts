import type { Principal } from '../../../shared/kernel/errors.js'
export interface Documents {
  read(
    p: Principal,
    id: string,
    page: number,
    offset: number,
    length: number,
  ): Promise<{
    documentId: string
    title: string
    publishedAt: string | null
    sourceKind: 'news' | 'bank'
    contentExtent: 'page' | 'lead' | 'full_text'
    page: number
    offset: number
    totalLength: number
    text: string
    externalUrl: string | null
  }>
  image(p: Principal, id: string, page: number): Promise<Uint8Array>
}
