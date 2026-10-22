import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, type BaseMessage } from '@langchain/core/messages'
import type { ChatResult } from '@langchain/core/outputs'
export class ScriptedModel extends BaseChatModel {
  calls = 0
  constructor(private readonly script: AIMessage[]) {
    super({})
  }
  _llmType() {
    return 'scripted-checkpoint-test'
  }
  override bindTools() {
    return this as never
  }
  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    this.calls++
    const message = this.script.shift()
    if (!message) throw new Error('Unexpected model replay')
    return {
      generations: [{ message, text: typeof message.content === 'string' ? message.content : '' }],
    }
  }
}
export const toolCall = () =>
  new AIMessage({
    content: '',
    tool_calls: [{ id: 'profile-1', type: 'tool_call', name: 'company_profile', args: {} }],
  })
