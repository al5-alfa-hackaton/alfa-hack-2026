import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const defaultDataDir = fileURLToPath(new URL('../../../data', import.meta.url))
const schema = z.object({
  DATA_DIR: z.string().default(defaultDataDir),
  LLM_BASE_URL: z.url().optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL_AGENT: z.string().min(1).optional(),
  LLM_MODEL_VISION: z.string().min(1).optional(),
  LLM_REASONING_EFFORT: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(50).default(12),
  AGENT_MAX_TOOL_CALLS: z.coerce.number().int().min(1).max(100).default(20),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(16000).default(4000),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),
})

export type Config = z.infer<typeof schema>
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ''))
  return schema.parse(cleaned)
}
export function dataPaths(config: Pick<Config, 'DATA_DIR'>) {
  const raw = `${config.DATA_DIR}/raw`
  const processed = `${config.DATA_DIR}/processed`
  return {
    companies: `${raw}/df_Uid_data_hack.csv`,
    personLinks: `${raw}/df_Fid_Uid_link_hack.csv`,
    payments: `${raw}/df_Uid_payment_hack.csv`,
    bankPdfDir: `${raw}/bank`,
    bankChunks: `${processed}/bank-chunks.json`,
    bankPages: `${processed}/bank-pages`,
    bankOcr: `${processed}/bank-ocr`,
    news: `${processed}/news.json`,
    processed,
  }
}
