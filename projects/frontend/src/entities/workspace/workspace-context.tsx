import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { z } from 'zod'
import { initialSession, type Session } from './model'

export const storageKey = 'alfa-demo-v1'
export const sessionSchema = z.object({
  company: z.enum(['nord', 'retail']),
  role: z.enum(['cfo', 'ceo']),
  entered: z.boolean(),
  saved: z.array(z.string()).max(100),
  feedback: z.record(z.string(), z.string().max(2000)),
  remarks: z.record(z.string(), z.string().max(1000)).default({}),
  chats: z.record(
    z.string(),
    z
      .array(
        z.object({
          author: z.enum(['user', 'assistant']),
          text: z.string().max(4000),
        }),
      )
      .max(100),
  ),
  history: z
    .array(
      z.object({
        id: z.string(),
        company: z.enum(['nord', 'retail']),
        role: z.enum(['cfo', 'ceo']),
        at: z.iso.datetime(),
        status: z.enum(['complete', 'partial', 'empty', 'failed', 'cancelled']),
      }),
    )
    .max(50),
})

type Workspace = {
  session: Session
  setSession: Dispatch<SetStateAction<Session>>
  ready: boolean
  storageWarning: boolean
}
const WorkspaceContext = createContext<Workspace | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(initialSession)
  const [ready, setReady] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = sessionSchema.safeParse(JSON.parse(raw))
        if (parsed.success) setSession(parsed.data)
        else setStorageWarning(true)
      }
    } catch {
      setStorageWarning(true)
    }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(session))
    } catch {
      setStorageWarning(true)
    }
  }, [ready, session])
  const value = useMemo(
    () => ({ session, setSession, ready, storageWarning }),
    [session, ready, storageWarning],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('WorkspaceProvider is required')
  return context
}
