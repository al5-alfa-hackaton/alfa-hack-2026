import { AppError } from '../../../shared/kernel/errors.js'
import type { Registration } from '../domain/model.js'
import type { IdentityStore, PasswordHasher } from './ports.js'
export class Identity {
  constructor(
    readonly store: IdentityStore,
    private readonly passwords: PasswordHasher,
    private readonly allowDataset: boolean,
  ) {}
  async authenticate(username: string, password: string) {
    const user = await this.store.byUsername(username)
    // Missing users take the same expensive password verification path as normal accounts.
    const valid = await this.passwords.verify(password, user?.passwordHash ?? 'missing')
    if (!user || !valid || (user.source === 'dataset' && !this.allowDataset))
      throw new AppError('unauthorized', 'Неверный логин или пароль')
    return user
  }
  async register(input: Registration) {
    const passwordHash = await this.passwords.hash(input.password)
    return this.store.register(
      { id: 'user_' + crypto.randomUUID(), username: input.username, passwordHash },
      { id: 'company_' + crypto.randomUUID(), profile: input.company },
    )
  }
  async resolve(id: string) {
    const user = await this.store.byId(id)
    return user?.source === 'dataset' && !this.allowDataset ? undefined : user
  }
}
