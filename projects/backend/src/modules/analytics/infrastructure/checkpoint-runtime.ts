import { createHash } from 'node:crypto'
import type pg from 'pg'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import {
  mapStoredMessagesToChatMessages,
  type BaseMessage,
  type StoredMessage,
} from '@langchain/core/messages'
import type { Run } from '../domain/model.js'
export const CHECKPOINT_SCHEMA = 'agent_checkpoints'
export class ExecutionError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}
async function guard(client: pg.PoolClient, runId: string, token: string) {
  const result = await client.query(
    'select status, lease_token, lease_until from analysis_runs where id=$1 for update',
    [runId],
  )
  const row = result.rows[0]
  if (
    !row ||
    row.status !== 'running' ||
    row.lease_token !== token ||
    !row.lease_until ||
    new Date(row.lease_until).getTime() <= Date.now()
  )
    throw new ExecutionError('lease_lost')
}
/** Official saver; its BEGIN and all checkpoint writes share the SQL row lock with the lease check. */
function fencedPool(pool: pg.Pool, runId: string, token: string): pg.Pool {
  return new Proxy(pool, {
    get(target, key) {
      if (key === 'connect')
        return async () => {
          const client = await target.connect()
          return new Proxy(client, {
            get(connection, prop) {
              if (prop === 'query')
                return async (text: string, values?: unknown[]) => {
                  const result = await connection.query(text, values)
                  if (text === 'BEGIN')
                    try {
                      await guard(connection, runId, token)
                    } catch (error) {
                      await connection.query('ROLLBACK')
                      throw error
                    }
                  return result
                }
              const value = Reflect.get(connection, prop)
              return typeof value === 'function' ? value.bind(connection) : value
            },
          })
        }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
export class ExecutionPersistence {
  readonly checkpointer: PostgresSaver
  constructor(
    private readonly pool: pg.Pool,
    private readonly run: Run,
    private readonly token: string,
    private readonly maxCalls: number,
  ) {
    this.checkpointer = new PostgresSaver(fencedPool(pool, run.id, token), undefined, {
      schema: CHECKPOINT_SCHEMA,
    })
  }
  private async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await guard(client, this.run.id, this.token)
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  async bindScope(scope: string) {
    await this.transaction(async (client) => {
      const result = await client.query(
        'update analysis_runs set execution_scope=$1 where id=$2 and (execution_scope is null or execution_scope=$1) returning id',
        [scope, this.run.id],
      )
      if (!result.rowCount) throw new ExecutionError('execution_context_changed')
    })
  }
  async call(
    key: string,
    invoke: () => Promise<BaseMessage>,
    messages: BaseMessage[],
  ): Promise<BaseMessage> {
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify(
          messages.map((m) => ({
            type: m.getType(),
            content: m.content,
            ...('tool_calls' in m ? { tool_calls: m.tool_calls } : {}),
            ...('tool_call_id' in m ? { tool_call_id: m.tool_call_id } : {}),
          })),
        ),
      )
      .digest('hex')
    const cached = await this.transaction(async (client) => {
      const result = await client.query(
        'select request_hash,response from agent_model_calls where run_id=$1 and call_key=$2',
        [this.run.id, key],
      )
      const row = result.rows[0]
      if (row) {
        if (row.request_hash !== fingerprint) throw new ExecutionError('execution_context_changed')
        if (!row.response) throw new ExecutionError('model_call_uncertain')
        return row.response as StoredMessage
      }
      const run = await client.query('select budget_day from analysis_runs where id=$1', [
        this.run.id,
      ])
      if (run.rows[0].budget_day !== new Date().toISOString().slice(0, 10))
        throw new ExecutionError('budget_window_expired')
      const count = await client.query(
        'select count(*)::int as count from agent_model_calls where run_id=$1',
        [this.run.id],
      )
      if (count.rows[0].count >= this.maxCalls) throw new ExecutionError('model_call_limit')
      await client.query(
        'insert into agent_model_calls(run_id,call_key,request_hash) values($1,$2,$3)',
        [this.run.id, key, fingerprint],
      )
      return null
    })
    if (cached) return mapStoredMessagesToChatMessages([cached])[0]!
    // A crash/timeout after this point is ambiguous. Never send a second paid request for this key.
    const response = await invoke()
    await this.transaction(async (client) => {
      await client.query(
        'update agent_model_calls set response=$1, completed_at=now() where run_id=$2 and call_key=$3',
        [response.toDict(), this.run.id, key],
      )
    })
    return response
  }
}
export class CheckpointRuntime {
  constructor(
    private readonly pool: pg.Pool,
    private readonly maxCalls: number,
  ) {}
  forRun(run: Run, token: string) {
    return new ExecutionPersistence(this.pool, run, token, this.maxCalls)
  }
}
export async function setupCheckpoints(pool: pg.Pool) {
  const client = await pool.connect()
  try {
    await client.query("select pg_advisory_lock(hashtextextended('alfa-checkpoint-migrations',0))")
    await new PostgresSaver(pool, undefined, { schema: CHECKPOINT_SCHEMA }).setup()
  } finally {
    await client.query(
      "select pg_advisory_unlock(hashtextextended('alfa-checkpoint-migrations',0))",
    )
    client.release()
  }
}
