import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { RunInput, RunStatus, Insight, Feedback } from '../../modules/analytics/index.js'
export const runs = pgTable(
  'analysis_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    companyId: text('company_id').notNull(),
    perspective: text('perspective', { enum: ['cfo', 'ceo'] }).notNull(),
    input: jsonb('input').$type<RunInput>().notNull(),
    status: text('status').$type<RunStatus>().notNull(),
    key: text('idempotency_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resultIds: jsonb('result_ids').$type<string[]>().notNull().default([]),
    error: text('error'),
    sequence: integer('sequence').notNull().default(0),
    dataMode: text('data_mode', { enum: ['fixture', 'research'] }).notNull(),
    budgetDay: text('budget_day').notNull(),
    reservation: numeric('reservation', { precision: 10, scale: 4, mode: 'number' }).notNull(),
    leaseToken: text('lease_token'),
    attempt: integer('attempt').notNull().default(0),
    executionScope: text('execution_scope'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('run_user_key').on(t.userId, t.key),
    index('run_scope_history').on(t.userId, t.companyId, t.perspective, t.createdAt),
    check(
      'run_status',
      sql`${t.status} in ('queued','running','cancelling','completed','partial','failed','cancelled')`,
    ),
    check('run_perspective', sql`${t.perspective} in ('cfo','ceo')`),
    check('run_reservation', sql`${t.reservation} >= 0`),
  ],
)
export const events = pgTable(
  'run_events',
  {
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.sequence] })],
)
export const outbox = pgTable('run_outbox', {
  version: integer('version').notNull().default(0),
  runId: text('run_id')
    .primaryKey()
    .references(() => runs.id, { onDelete: 'cascade' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
})
export const budgets = pgTable(
  'daily_budgets',
  {
    day: text('day').primaryKey(),
    reserved: numeric('reserved', { precision: 12, scale: 4, mode: 'number' }).notNull().default(0),
    spent: numeric('spent', { precision: 12, scale: 4, mode: 'number' }).notNull().default(0),
  },
  (t) => [check('budget_nonnegative', sql`${t.reserved} >= 0 and ${t.spent} >= 0`)],
)
export const insights = pgTable(
  'insights',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull(),
    perspective: text('perspective', { enum: ['cfo', 'ceo'] }).notNull(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
    data: jsonb('data').$type<Insight>().notNull(),
  },
  (t) => [index('insight_scope').on(t.companyId, t.perspective)],
)
export const snapshots = pgTable(
  'feed_snapshots',
  {
    companyId: text('company_id').notNull(),
    perspective: text('perspective').notNull(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.perspective] })],
)
export const userStates = pgTable(
  'insight_user_states',
  {
    userId: text('user_id').notNull(),
    insightId: text('insight_id')
      .notNull()
      .references(() => insights.id),
    version: text('version').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }),
    feedback: jsonb('feedback').$type<Feedback>().notNull().default({ rating: null, comment: '' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.insightId, t.version] })],
)
export const messages = pgTable(
  'conversation_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    insightId: text('insight_id')
      .notNull()
      .references(() => insights.id),
    version: text('version').notNull(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id),
    author: text('author', { enum: ['user', 'assistant'] }).notNull(),
    text: text('text').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('message_run_author').on(t.runId, t.author)],
)

export const modelCalls = pgTable(
  'agent_model_calls',
  {
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    callKey: text('call_key').notNull(),
    requestHash: text('request_hash').notNull(),
    response: jsonb('response'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.runId, t.callKey] })],
)
