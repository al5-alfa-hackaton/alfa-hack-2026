import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages'
import type { ChatResult } from '@langchain/core/outputs'
import { describe, expect, it } from 'vitest'
import { buildAgentGraph } from '../src/agent/graph.js'
import type { ToolCallRecord } from '../src/tools/index.js'
import { fixtureContext } from './helpers.js'

class ScriptedModel extends BaseChatModel {
  constructor(private script: AIMessage[]) {
    super({})
  }
  _llmType() {
    return 'scripted'
  }
  override bindTools() {
    return this as never
  }
  async _generate(_m: BaseMessage[], _o: this['ParsedCallOptions'], _r?: CallbackManagerForLLMRun): Promise<ChatResult> {
    const message = this.script.shift()
    if (!message) throw new Error('script exhausted')
    return { generations: [{ message, text: typeof message.content === 'string' ? message.content : '' }] }
  }
}

const call = (name: string, args: object, id: string) => new AIMessage({ content: '', tool_calls: [{ name, args, id, type: 'tool_call' }] })

describe('agent loop', () => {
  it('calls tools, feeds results back and stops on a text answer', async () => {
    const ctx = await fixtureContext()
    const audit: ToolCallRecord[] = []
    const model = new ScriptedModel([
      call('company_profile', {}, 't1'),
      call('news_search', { query: 'ключевая ставка' }, 't2'),
      new AIMessage('Ставка сохранена на 14% [news_rate].'),
    ])
    const graph = buildAgentGraph({ ctx, model, limits: { maxSteps: 6, maxToolCalls: 10 }, audit })
    const result = await graph.invoke({ messages: [new HumanMessage('Что со ставкой?')] }, { configurable: { companyId: 'U_1' } })

    expect(audit.map((a) => a.tool)).toEqual(['company_profile', 'news_search'])
    expect(result.messages.filter((m) => m instanceof ToolMessage)).toHaveLength(2)
    expect(result.stopReason).toBe('answered')
    expect(result.steps).toBe(3)
  })

  it('answers from collected data when the step limit is reached', async () => {
    const ctx = await fixtureContext()
    const model = new ScriptedModel([
      ...Array.from({ length: 2 }, (_, i) => call('company_profile', {}, `t${i}`)),
      new AIMessage('Ответ по собранным данным.'),
    ])
    const graph = buildAgentGraph({ ctx, model, limits: { maxSteps: 2, maxToolCalls: 10 } })
    const result = await graph.invoke({ messages: [new HumanMessage('?')] }, { configurable: { companyId: 'U_1' } })
    expect(result.stopReason).toBe('limit')
    expect(result.steps).toBe(2)
    expect(result.messages.at(-1)?.content).toBe('Ответ по собранным данным.')
  })
})
