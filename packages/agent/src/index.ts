// Import-safe production surface. CLI entrypoints are deliberately not exported.
export { loadConfig as loadResearchConfig, dataPaths } from './config.js'
export { loadDataContext, buildDataContext, type DataContext } from './data/context.js'
export { loadCompanyStore } from './data/companies.js'
export { buildAgentGraph, textOf } from './agent/graph.js'
export { buildTaskPrompt, clarificationAllowed, PROMPT_VERSION, type TaskEvent } from './agent/prompts.js'
export { createChatModel } from './llm.js'
export {
  companyProfile,
  companyGroup,
  companyCounterparties,
  documentRead,
  evidenceVerify,
} from './tools/functions.js'
export { type ToolCallRecord } from './tools/index.js'
export {
  parseFeedAnswer,
  toStructuredDraft,
  createFeedFinalizer,
  type FeedParseResult,
  type ParsedEvent,
  type DraftClaim,
  type FeedNote,
} from './agent/feed-parser.js'
export { loadNewsTags, type NewsTag, type NewsTags } from './news/tagging.js'
export {
  rankNewsForCompany,
  companyExposures,
  tagCoverage,
  ML_RANKING_VERSION,
  type RankedNewsItem,
} from './news/ranking.js'

export type { Company } from './data/companies.js'
