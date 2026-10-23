import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../infrastructure/database/client.js'
import { users, memberships, customCompanies } from '../../../infrastructure/database/schema.js'
import { AppError } from '../../../shared/kernel/errors.js'
import type { IdentityStore } from '../application/ports.js'
import type { CompanyInput, IdentityRecord } from '../domain/model.js'
export class PostgresIdentityStore implements IdentityStore {
  constructor(private readonly db: Database) {}
  private async find(where: ReturnType<typeof eq>): Promise<IdentityRecord | undefined> {
    const [user] = await this.db.select().from(users).where(where).limit(1)
    if (!user) return undefined
    const scope = await this.db
      .select({ companyId: memberships.companyId })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
    return { ...user, companyIds: scope.map((row) => row.companyId) }
  }
  byId(id: string) {
    return this.find(eq(users.id, id))
  }
  byUsername(username: string) {
    return this.find(eq(users.username, username))
  }
  async register(
    user: { id: string; username: string; passwordHash: string },
    company: { id: string; profile: CompanyInput },
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.insert(users).values({ ...user, source: 'custom' })
        await tx.insert(customCompanies).values(company)
        await tx.insert(memberships).values({ userId: user.id, companyId: company.id })
        return { ...user, source: 'custom' as const, companyIds: [company.id] }
      })
    } catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } }
      if (cause.code === '23505' || cause.cause?.code === '23505')
        throw new AppError('username_taken', 'Этот логин уже занят')
      throw error
    }
  }
  async customCompanies(ids: readonly string[]) {
    return ids.length
      ? this.db
          .select({ id: customCompanies.id, profile: customCompanies.profile })
          .from(customCompanies)
          .where(inArray(customCompanies.id, [...ids]))
      : []
  }
}
