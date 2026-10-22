import type { BaseMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import type { Config } from './config.js'

export function requireLlm(config: Config) {
  const { LLM_BASE_URL, LLM_API_KEY } = config
  if (!LLM_BASE_URL || !LLM_API_KEY) {
    throw new Error(
      'LLM_BASE_URL и LLM_API_KEY не заданы: заполните research/agent/.env (шаблон — .env.example)',
    )
  }
  return { baseURL: LLM_BASE_URL, apiKey: LLM_API_KEY }
}

export function createChatModel(
  config: Config,
  model: string,
  overrides: {
    temperature?: number
    reasoningEffort?: Config['LLM_REASONING_EFFORT']
    maxRetries?: number
  } = {},
) {
  const { baseURL, apiKey } = requireLlm(config)
  return new ChatOpenAI({
    model,
    apiKey,
    configuration: { baseURL },
    temperature: overrides.temperature ?? 0.2,
    maxTokens: config.LLM_MAX_OUTPUT_TOKENS,
    timeout: config.LLM_TIMEOUT_MS,
    maxRetries: overrides.maxRetries ?? 2,
    modelKwargs: { reasoning_effort: overrides.reasoningEffort ?? config.LLM_REASONING_EFFORT },
  })
}

export function costOf(message: BaseMessage): number {
  const cost = (message.response_metadata as { usage?: { cost?: unknown } } | undefined)?.usage
    ?.cost
  return typeof cost === 'number' ? cost : 0
}
