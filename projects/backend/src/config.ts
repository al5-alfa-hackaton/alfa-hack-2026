import { z } from 'zod'

const schema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url().optional(),
})

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return schema.parse(env)
}

export type Config = ReturnType<typeof loadConfig>
