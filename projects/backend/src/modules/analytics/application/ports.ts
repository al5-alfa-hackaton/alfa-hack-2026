import type { Principal } from '../../../shared/kernel/errors.js'
import type {
  Feedback,
  Insight,
  Message,
  Perspective,
  Run,
  RunEvent,
  RunInput,
  UserState,
} from '../domain/model.js'
export interface AnalyticsStore {
  createRun(
    principal: Principal,
    input: RunInput,
    key: string,
    fingerprint: string,
    reservation: number,
    limit: number,
    mode: 'fixture' | 'research',
  ): Promise<Run>
  run(principal: Principal, id: string): Promise<Run>
  history(principal: Principal, companyId: string, perspective: Perspective): Promise<Run[]>
  cancel(principal: Principal, id: string): Promise<Run>
  events(principal: Principal, id: string, after: number): Promise<RunEvent[]>
  insights(companyId: string, perspective: Perspective): Promise<Insight[]>
  insight(principal: Principal, id: string, perspective: Perspective): Promise<Insight>
  savedInsights(
    principal: Principal,
    companyId: string,
    perspective: Perspective,
  ): Promise<Insight[]>
  userState(principal: Principal, insight: Insight): Promise<UserState>
  saveState(
    principal: Principal,
    insight: Insight,
    patch: { saved?: boolean; feedback?: Feedback },
  ): Promise<UserState>
  messages(principal: Principal, insight: Insight): Promise<Message[]>
  trace(principal: Principal, insight: Insight): Promise<RunEvent[]>
}
export type AgentResult = { insights: Insight[]; answer?: string }
export interface AgentRuntime {
  execute(
    run: Run,
    signal: AbortSignal,
    progress: (type: string, payload: Record<string, unknown>) => Promise<void>,
  ): Promise<AgentResult>
}
