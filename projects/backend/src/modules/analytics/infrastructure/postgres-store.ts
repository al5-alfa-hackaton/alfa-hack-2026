import { randomUUID } from 'node:crypto'
import { and, eq, desc, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { Database } from '../../../infrastructure/database/client.js'
import * as t from '../../../infrastructure/database/schema.js'
import { AppError, requireCompany, type Principal } from '../../../shared/kernel/errors.js'
import type { AnalyticsStore, AgentResult } from '../application/ports.js'
import {
  terminal,
  type Feedback,
  type Insight,
  type Perspective,
  type Run,
  type RunEvent,
  type RunInput,
} from '../domain/model.js'
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]
function mapRun(r: typeof t.runs.$inferSelect): Run {
  return {
    id: r.id,
    userId: r.userId,
    companyId: r.companyId,
    perspective: r.perspective,
    input: r.input,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    resultIds: r.resultIds,
    error: r.error,
    sequence: r.sequence,
    dataMode: r.dataMode,
  }
}
async function event(tx: Tx, id: string, type: string, payload: Record<string, unknown> = {}) {
  const [row] = await tx
    .update(t.runs)
    .set({ sequence: sql`${t.runs.sequence}+1`, updatedAt: new Date() })
    .where(eq(t.runs.id, id))
    .returning({ sequence: t.runs.sequence })
  if (row) await tx.insert(t.events).values({ runId: id, sequence: row.sequence, type, payload })
}
async function settle(tx: Tx, row: typeof t.runs.$inferSelect, charged: boolean) {
  await tx
    .update(t.budgets)
    .set({
      reserved: sql`${t.budgets.reserved}-${row.reservation}`,
      spent: sql`${t.budgets.spent}+${charged ? row.reservation : 0}`,
    })
    .where(eq(t.budgets.day, row.budgetDay))
}
export class PostgresStore implements AnalyticsStore {
  constructor(readonly db: Database) {}
  async createRun(
    p: Principal,
    input: RunInput,
    key: string,
    fingerprint: string,
    reservation: number,
    limit: number,
    mode: 'fixture' | 'research',
  ) {
    requireCompany(p, input.companyId)
    return this.db.transaction(async (tx) => {
      // Serializes identical user keys even when the first row does not exist yet.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${p.id + ':' + key},0))`)
      const [existing] = await tx
        .select()
        .from(t.runs)
        .where(and(eq(t.runs.userId, p.id), eq(t.runs.key, key)))
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new AppError('idempotency_conflict', 'Ключ уже использован с другим запросом')
        requireCompany(p, existing.companyId)
        return mapRun(existing)
      }
      const day = new Date().toISOString().slice(0, 10) // 00:00 UTC = 03:00 Europe/Moscow.
      await tx.insert(t.budgets).values({ day }).onConflictDoNothing()
      const [budget] = await tx
        .update(t.budgets)
        .set({ reserved: sql`${t.budgets.reserved}+${reservation}` })
        .where(
          and(
            eq(t.budgets.day, day),
            sql`${t.budgets.spent}+${t.budgets.reserved}+${reservation}<=${limit}`,
          ),
        )
        .returning()
      if (!budget)
        throw new AppError(
          'budget_exhausted',
          'Дневной бюджет исчерпан',
          false,
          new Date(Date.parse(day) + 86400000).toISOString(),
        )
      const id = randomUUID()
      const [row] = await tx
        .insert(t.runs)
        .values({
          id,
          userId: p.id,
          companyId: input.companyId,
          perspective: input.perspective,
          input,
          key,
          fingerprint,
          status: 'queued',
          dataMode: mode,
          budgetDay: day,
          reservation,
        })
        .returning()
      await tx.insert(t.outbox).values({ runId: id })
      if (input.kind === 'question')
        await tx.insert(t.messages).values({
          id: randomUUID(),
          userId: p.id,
          insightId: input.insightId!,
          version: input.insightVersion!,
          runId: id,
          author: 'user',
          text: input.question!,
        })
      await event(tx, id, 'run.queued')
      return { ...mapRun(row!), sequence: 1 }
    })
  }
  async run(p: Principal, id: string) {
    const [row] = await this.db
      .select()
      .from(t.runs)
      .where(and(eq(t.runs.id, id), eq(t.runs.userId, p.id)))
    if (!row) throw new AppError('not_found', 'Запуск недоступен')
    requireCompany(p, row.companyId)
    return mapRun(row)
  }
  async history(p: Principal, companyId: string, perspective: Perspective) {
    requireCompany(p, companyId)
    return (
      await this.db
        .select()
        .from(t.runs)
        .where(
          and(
            eq(t.runs.userId, p.id),
            eq(t.runs.companyId, companyId),
            eq(t.runs.perspective, perspective),
          ),
        )
        .orderBy(desc(t.runs.createdAt))
        .limit(100)
    ).map(mapRun)
  }
  async cancel(p: Principal, id: string) {
    await this.run(p, id)
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(t.runs)
        .where(and(eq(t.runs.id, id), eq(t.runs.userId, p.id)))
        .for('update')
      if (!row) throw new AppError('not_found', 'Запуск недоступен')
      if (row.status === 'cancelled' || row.status === 'cancelling') return
      if (terminal(row.status)) throw new AppError('already_terminal', 'Запуск уже завершён')
      const status = row.status === 'queued' ? 'cancelled' : 'cancelling'
      await tx.update(t.runs).set({ status }).where(eq(t.runs.id, id))
      if (status === 'cancelled') await settle(tx, row, false)
      await event(tx, id, status === 'cancelled' ? 'run.cancelled' : 'run.progress', {
        phase: status,
      })
    })
    return this.run(p, id)
  }
  async events(p: Principal, id: string, after: number) {
    await this.run(p, id)
    return this.eventRows(id, after)
  }
  private async eventRows(id: string, after: number): Promise<RunEvent[]> {
    return (
      await this.db
        .select()
        .from(t.events)
        .where(and(eq(t.events.runId, id), gt(t.events.sequence, after)))
        .orderBy(t.events.sequence)
        .limit(1000)
    ).map((e) => ({
      id: `${id}:${e.sequence}`,
      runId: id,
      sequence: e.sequence,
      at: e.at.toISOString(),
      type: e.type,
      payload: e.payload,
    }))
  }
  async insights(companyId: string, perspective: Perspective) {
    const [snapshot] = await this.db
      .select()
      .from(t.snapshots)
      .where(and(eq(t.snapshots.companyId, companyId), eq(t.snapshots.perspective, perspective)))
    if (!snapshot) return []
    return (
      await this.db
        .select()
        .from(t.insights)
        .where(
          and(
            eq(t.insights.runId, snapshot.runId),
            eq(t.insights.companyId, companyId),
            eq(t.insights.perspective, perspective),
          ),
        )
    )
      .map((r) => r.data)
      .sort((a, b) => a.relevance.rank - b.relevance.rank)
  }
  async insight(p: Principal, id: string, perspective: Perspective) {
    const [row] = await this.db
      .select()
      .from(t.insights)
      .where(and(eq(t.insights.id, id), eq(t.insights.perspective, perspective)))
    if (!row) throw new AppError('not_found', 'Разбор недоступен')
    requireCompany(p, row.companyId)
    return row.data
  }
  async savedInsights(p: Principal, companyId: string, perspective: Perspective) {
    requireCompany(p, companyId)
    return (
      await this.db
        .select({ data: t.insights.data })
        .from(t.insights)
        .innerJoin(t.userStates, eq(t.userStates.insightId, t.insights.id))
        .where(
          and(
            eq(t.userStates.userId, p.id),
            eq(t.insights.companyId, companyId),
            eq(t.insights.perspective, perspective),
            sql`${t.userStates.savedAt} is not null`,
          ),
        )
        .orderBy(desc(t.userStates.savedAt))
        .limit(100)
    ).map((r) => r.data)
  }
  async userState(p: Principal, i: Insight) {
    const [row] = await this.db
      .select()
      .from(t.userStates)
      .where(
        and(
          eq(t.userStates.userId, p.id),
          eq(t.userStates.insightId, i.id),
          eq(t.userStates.version, i.version),
        ),
      )
    return {
      savedAt: row?.savedAt?.toISOString() ?? null,
      feedback: row?.feedback ?? { rating: null, comment: '' },
    }
  }
  async saveState(p: Principal, i: Insight, patch: { saved?: boolean; feedback?: Feedback }) {
    const changes = {
      ...(patch.saved !== undefined ? { savedAt: patch.saved ? new Date() : null } : {}),
      ...(patch.feedback ? { feedback: patch.feedback } : {}),
    }
    await this.db
      .insert(t.userStates)
      .values({ userId: p.id, insightId: i.id, version: i.version, ...changes })
      .onConflictDoUpdate({
        target: [t.userStates.userId, t.userStates.insightId, t.userStates.version],
        set: changes,
      })
    return this.userState(p, i)
  }
  async messages(p: Principal, i: Insight) {
    return (
      await this.db
        .select()
        .from(t.messages)
        .where(
          and(
            eq(t.messages.userId, p.id),
            eq(t.messages.insightId, i.id),
            eq(t.messages.version, i.version),
          ),
        )
        .orderBy(t.messages.at)
        .limit(100)
    ).map((r) => ({
      id: r.id,
      runId: r.runId,
      author: r.author,
      text: r.text,
      at: r.at.toISOString(),
    }))
  }
  async trace(_p: Principal, i: Insight) {
    // These events contain only allowlisted public step metadata, never prompts/tool arguments.
    return this.eventRows(i.runId, 0)
  }
  async pending() {
    return this.db.select().from(t.outbox).where(isNull(t.outbox.publishedAt)).limit(100)
  }
  async dispatched(id: string) {
    await this.db.update(t.outbox).set({ publishedAt: new Date() }).where(eq(t.outbox.runId, id))
  }
  async claim(id: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.runs)
        .set({ status: 'running', leaseUntil: new Date(Date.now() + 45000) })
        .where(and(eq(t.runs.id, id), eq(t.runs.status, 'queued')))
        .returning()
      if (!row) return null
      await event(tx, id, 'step.started', { phase: 'collecting_context' })
      return mapRun(row)
    })
  }
  async heartbeat(id: string) {
    const [row] = await this.db
      .update(t.runs)
      .set({ leaseUntil: new Date(Date.now() + 45000) })
      .where(and(eq(t.runs.id, id), inArray(t.runs.status, ['running', 'cancelling'])))
      .returning({ status: t.runs.status })
    return row?.status
  }
  async progress(id: string, type: string, payload: Record<string, unknown>) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(t.runs).where(eq(t.runs.id, id)).for('update')
      if (row?.status === 'running') await event(tx, id, type, payload)
    })
  }
  async finish(id: string, result?: AgentResult, error?: string, expiredOnly = false) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(t.runs).where(eq(t.runs.id, id)).for('update')
      if (!row || terminal(row.status)) return
      if (expiredOnly && (!row.leaseUntil || row.leaseUntil.getTime() >= Date.now())) return
      const cancelled = row.status === 'cancelling'
      const status = cancelled
        ? 'cancelled'
        : error
          ? 'failed'
          : result?.insights.some((i) => i.status !== 'complete')
            ? 'partial'
            : 'completed'
      const ids: string[] = []
      if (!cancelled && !error && result) {
        for (const insight of result.insights) {
          await tx.insert(t.insights).values({
            id: insight.id,
            companyId: row.companyId,
            perspective: row.perspective,
            runId: id,
            data: insight,
          })
          ids.push(insight.id)
        }
        if (row.input.kind === 'refresh_feed')
          await tx
            .insert(t.snapshots)
            .values({ companyId: row.companyId, perspective: row.perspective, runId: id })
            .onConflictDoUpdate({
              target: [t.snapshots.companyId, t.snapshots.perspective],
              set: { runId: id },
              setWhere: sql`(select created_at from analysis_runs where id = ${t.snapshots.runId}) <= ${row.createdAt}`,
            })
        if (row.input.kind === 'question' && result.answer)
          await tx
            .insert(t.messages)
            .values({
              id: randomUUID(),
              userId: row.userId,
              insightId: row.input.insightId!,
              version: row.input.insightVersion!,
              runId: id,
              author: 'assistant',
              text: result.answer,
            })
            .onConflictDoNothing()
      }
      await tx
        .update(t.runs)
        .set({ status, resultIds: ids, error: error ?? null, leaseUntil: null })
        .where(eq(t.runs.id, id))
      await settle(tx, row, true) // Unknown gateway cost consumes the entire conservative reservation.
      await event(tx, id, `run.${status}`, { resultIds: ids, ...(error ? { code: error } : {}) })
    })
  }
  async recoverExpired() {
    const rows = await this.db
      .select({ id: t.runs.id })
      .from(t.runs)
      .where(
        and(inArray(t.runs.status, ['running', 'cancelling']), lt(t.runs.leaseUntil, new Date())),
      )
    for (const row of rows) await this.finish(row.id, undefined, 'worker_lost', true)
  }
}
