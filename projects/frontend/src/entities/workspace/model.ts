import type { CompanyId, Role } from '@/entities/company'
import type { RunRecord } from '@/entities/analysis'
export type Message = { author: 'user' | 'assistant'; text: string }
export type Session = {
  company: CompanyId
  role: Role
  entered: boolean
  saved: string[]
  feedback: Record<string, string>
  remarks: Record<string, string>
  chats: Record<string, Message[]>
  history: RunRecord[]
}
export const initialSession: Session = {
  company: 'nord',
  role: 'cfo',
  entered: false,
  saved: [],
  feedback: {},
  remarks: {},
  chats: {},
  history: [],
}
export function scopeKey(company: CompanyId, role: Role, id: string) {
  return `${company}:${role}:${id}`
}
