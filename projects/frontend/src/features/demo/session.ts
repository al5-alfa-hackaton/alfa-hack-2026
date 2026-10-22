import { useEffect, useState } from "react";
import { z } from "zod";
import { initialSession, type Session } from "./model";
const key = "alfa-demo-v1";
const schema = z.object({
  company: z.enum(["nord", "retail"]),
  role: z.enum(["cfo", "ceo"]),
  entered: z.boolean(),
  saved: z.array(z.string()).max(100),
  feedback: z.record(z.string(), z.string().max(2000)),
  chats: z.record(
    z.string(),
    z
      .array(
        z.object({
          author: z.enum(["user", "assistant"]),
          text: z.string().max(4000),
        }),
      )
      .max(100),
  ),
  history: z
    .array(
      z.object({
        id: z.string(),
        company: z.enum(["nord", "retail"]),
        role: z.enum(["cfo", "ceo"]),
        at: z.string(),
        status: z.enum(["complete", "partial", "empty", "failed", "cancelled"]),
      }),
    )
    .max(50),
});
export function useDemoSession() {
  const [session, setSession] = useState<Session>(initialSession);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success) setSession(parsed.data);
        else setStorageWarning(true);
      }
    } catch {
      setStorageWarning(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch {
        setStorageWarning(true);
      }
    }
  }, [session, ready]);
  return { session, setSession, ready, storageWarning };
}
