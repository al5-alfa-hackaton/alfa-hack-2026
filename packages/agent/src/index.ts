// Import-safe production surface. CLI entrypoints are deliberately not exported.
export { loadConfig as loadResearchConfig, dataPaths } from './config.js'
export { loadDataContext, buildDataContext, reloadNews, type DataContext } from './data/context.js'
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
export { FEATURE_IDS, FEATURE_LABELS, isFeatureId, type FeatureId } from './features.js'
export {
  parseFeedAnswer,
  toStructuredDraft,
  noteLine,
  createFeedFinalizer,
  keepCards,
  staleBankQuote,
  type FeedParseResult,
  type ParsedEvent,
  type DraftClaim,
  type FeedNote,
} from './agent/feed-parser.js'
export { verifyResult, VERIFY_PROMPT_VERSION, type Verdict, type VerifyInvoke } from './agent/verify.js'
export { loadNewsTags, type NewsTag, type NewsTags } from './news/tagging.js'
export { NEWS_SOURCES, NEWS_SOURCE_IDS } from './data/news.js'
export { NEWS_TAG_PROMPT_VERSION } from './agent/prompts.js'
export {
  rankNewsForCompany,
  companyExposures,
  inferOkvedGroup,
  sameEvent,
  tagCoverage,
  ML_RANKING_VERSION,
  type RankedNewsItem,
} from './news/ranking.js'

export type { Company } from './data/companies.js'
