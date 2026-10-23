import { z } from 'zod'
import { fileURLToPath } from 'node:url'
import { DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT } from './modules/analytics/domain/ranking.js'
export const accountsSchema = z.array(
  z.object({
    id: z.string().min(1).max(100),
    token: z.string().min(32),
    companyIds: z.array(z.string().min(1).max(100)).min(1),
  }),
)
const bool = z.enum(['true', 'false']).transform((v) => v === 'true')
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().default('redis://127.0.0.1:6379'),
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('alfa'),
  DEV_AUTH: bool.default(false),
  ALLOW_UNCAPPED_LLM: bool.default(false),
  AUTH_USERS_JSON: z.string().default('[]'),
  AUTH_SESSION_SECRET: z.string().min(32).optional(),
  ALLOW_DATASET_LOGIN: bool.optional(),
  AGENT_PROVIDER: z.enum(['disabled', 'fixture', 'langgraph']).default('disabled'),
  DATA_DIR: z.string().default(fileURLToPath(new URL('../../../data', import.meta.url))),
  LLM_BASE_URL: z.url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL_AGENT: z
    .enum([
      'deepseek/deepseek-v4.1-flash',
      'qwen/qwen3.6-35b-a3b',
      'qwen/qwen3-vl-30b-a3b-instruct',
      'google/gemma-4-26b-a4b-it',
      'z-ai/glm-5.3-flash',
      'moonshotai/kimi-k2.6',
    ])
    .default('deepseek/deepseek-v4.1-flash'),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  RUN_MAX_RECOVERIES: z.coerce.number().int().min(0).max(3).default(2),
  RANKING_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_RANKING_LIMIT)
    .default(DEFAULT_RANKING_LIMIT),
  RUN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(180000),
  DAILY_BUDGET_RUB: z.coerce.number().min(0.01).multipleOf(0.01).max(500).default(500),
  RUN_RESERVATION_RUB: z.coerce.number().min(0.01).multipleOf(0.01).max(500).default(25),
  // Live runs fail closed until the gateway operator confirms a hard per-request cap.
  LLM_GATEWAY_REQUEST_CAP_RUB: z.coerce.number().positive().optional(),
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(12).default(6),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(20).default(12),
})
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = schema.parse({
    ...(env.NODE_ENV === 'test' ? { AGENT_PROVIDER: 'fixture' } : {}),
    ...Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '' && v !== undefined)),
  })
  let accounts: z.infer<typeof accountsSchema>
  try {
    accounts = accountsSchema.parse(JSON.parse(config.AUTH_USERS_JSON))
  } catch {
    throw new Error('AUTH_USERS_JSON must contain valid server accounts')
  }
  if (
    new Set(accounts.map((a) => a.id)).size !== accounts.length ||
    new Set(accounts.map((a) => a.token)).size !== accounts.length
  )
    throw new Error('Account IDs and tokens must be unique')
  if (config.NODE_ENV === 'production' && !accounts.length && !config.DATABASE_URL)
    throw new Error('Production requires a database or server accounts')
  if (config.NODE_ENV === 'production' && (config.DEV_AUTH || config.AGENT_PROVIDER === 'fixture'))
    throw new Error('Production requires authentication and the langgraph provider')
  if (config.ALLOW_UNCAPPED_LLM && config.NODE_ENV !== 'development')
    throw new Error('ALLOW_UNCAPPED_LLM is only permitted in development')
  if (config.NODE_ENV === 'production' && !config.AUTH_SESSION_SECRET)
    throw new Error('Production requires AUTH_SESSION_SECRET')
  if (config.AGENT_PROVIDER === 'langgraph') {
    if (!config.LLM_API_KEY || !config.LLM_BASE_URL || !config.DATA_DIR)
      throw new Error('LangGraph requires LLM_BASE_URL, LLM_API_KEY and DATA_DIR')
    if (
      !config.ALLOW_UNCAPPED_LLM &&
      (!config.LLM_GATEWAY_REQUEST_CAP_RUB ||
        config.LLM_GATEWAY_REQUEST_CAP_RUB * (config.AGENT_MAX_STEPS + 2) >
          config.RUN_RESERVATION_RUB)
    )
      throw new Error('Confirm the gateway hard request cap and reserve (maxSteps + 2) calls')
  }
  return {
    ...config,
    ALLOW_DATASET_LOGIN: config.ALLOW_DATASET_LOGIN ?? config.NODE_ENV !== 'production',
    accounts,
  }
}
export type Config = ReturnType<typeof loadConfig>
