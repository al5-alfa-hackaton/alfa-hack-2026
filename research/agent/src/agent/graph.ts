import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { Annotation, END, messagesStateReducer, START, StateGraph } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import type { RunnableConfig } from '@langchain/core/runnables'
import type { DataContext } from '../data/context.js'
import { createTools, type ToolCallRecord } from '../tools/index.js'
import { AGENT_SYSTEM_PROMPT, LIMIT_REACHED_PROMPT } from './prompts.js'

export type AgentLimits = { maxSteps: number; maxToolCalls: number }

const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  steps: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  toolCalls: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  executionScope: Annotation<string | null>({ reducer: (_, b) => b, default: () => null }),
  structured: Annotation<BaseMessage | null>({ reducer: (_, b) => b, default: () => null }),
  stopReason: Annotation<'answered' | 'limit' | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
})

export type AgentState = typeof State.State

export function textOf(message: BaseMessage): string {
  const { content } = message
  if (typeof content === 'string') return content
  return content
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
}

export function buildAgentGraph(opts: {
  ctx: DataContext
  model: BaseChatModel
  limits: AgentLimits
  audit?: ToolCallRecord[]
  checkpointer?: BaseCheckpointSaver
  invokeModel?: (
    key: string,
    invoke: () => Promise<BaseMessage>,
    messages: BaseMessage[],
  ) => Promise<BaseMessage>
  finalize?: (state: AgentState, config: RunnableConfig) => Promise<BaseMessage>
  interruptAfter?: ('agent' | 'tools' | 'answered' | 'limit' | 'finalize')[]
}) {
  const { ctx, model, limits } = opts
  const tools = createTools(ctx, opts.audit)
  if (!model.bindTools) throw new Error('Модель не поддерживает tool calling')
  const agentModel = model.bindTools(tools)

  async function agent(state: AgentState, config: RunnableConfig) {
    const messages = [new SystemMessage(AGENT_SYSTEM_PROMPT), ...state.messages]
    const invoke = () => agentModel.invoke(messages, config)
    const response = await (opts.invokeModel
      ? opts.invokeModel(`agent:${state.steps}`, invoke, messages)
      : invoke())
    const calls = response instanceof AIMessage ? (response.tool_calls?.length ?? 0) : 0
    return { messages: [response], steps: state.steps + 1, toolCalls: state.toolCalls + calls }
  }

  async function limit(state: AgentState, config: RunnableConfig) {
    const last = state.messages.at(-1)
    const history =
      last instanceof AIMessage && last.tool_calls?.length
        ? state.messages.slice(0, -1)
        : state.messages
    const messages = [
      new SystemMessage(AGENT_SYSTEM_PROMPT),
      ...history,
      new HumanMessage(LIMIT_REACHED_PROMPT),
    ]
    const invoke = () => model.invoke(messages, config)
    const response = await (opts.invokeModel
      ? opts.invokeModel('limit', invoke, messages)
      : invoke())
    return { messages: [response], stopReason: 'limit' as const }
  }

  function route(state: AgentState) {
    const last = state.messages.at(-1)
    const wantsTools = last instanceof AIMessage && Boolean(last.tool_calls?.length)
    if (!wantsTools) return 'answered'
    if (state.steps >= limits.maxSteps || state.toolCalls > limits.maxToolCalls) return 'limit'
    return 'tools'
  }

  return new StateGraph(State)
    .addNode('agent', agent)
    .addNode('tools', new ToolNode(tools))
    .addNode('answered', () => ({ stopReason: 'answered' as const }))
    .addNode('limit', limit)
    .addNode('finalize', async (state, config) =>
      opts.finalize ? { structured: await opts.finalize(state, config) } : {},
    )
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', route, ['tools', 'answered', 'limit'])
    .addEdge('tools', 'agent')
    .addEdge('answered', 'finalize')
    .addEdge('limit', 'finalize')
    .addEdge('finalize', END)
    .compile({ checkpointer: opts.checkpointer, interruptAfter: opts.interruptAfter })
}
