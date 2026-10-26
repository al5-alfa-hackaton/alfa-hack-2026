import { AppError } from '../../../shared/kernel/errors.js'
import type { Registration } from '../domain/model.js'
import type { IdentityStore } from './ports.js'
export class Identity {
  constructor(readonly store: IdentityStore) {}
  async open(accountId: string) {
    const user = await this.store.byId(accountId)
    if (!user) throw new AppError('unauthorized', 'Аккаунт не найден')
    return user
  }
  search(query: string, limit = 20) {
    return this.store.search(query, limit)
  }
  async register(input: Registration) {
    return this.store.register(
      {
        id: 'user_' + crypto.randomUUID(),
        username: input.username,
        sessionVersion: crypto.randomUUID(),
      },
      { id: 'company_' + crypto.randomUUID(), profile: input.company },
    )
  }
  async resolve(id: string) {
    return this.store.byId(id)
  }
}
