import { eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../../../infrastructure/database/client.js'
import { memberships, users } from '../../../infrastructure/database/schema.js'
import { hashDatasetPassword } from './passwords.js'
export type DatasetAccount = { companyId: string; username: string; password: string }
export async function seedDatasetAccounts(db: Database, accounts: readonly DatasetAccount[]) {
  await db.transaction(async (tx) => {
    for (let offset = 0; offset < accounts.length; offset += 500) {
      const batch = accounts.slice(offset, offset + 500)
      const rows = batch.map((account) => ({
        id: 'dataset:' + account.companyId,
        username: account.username,
        passwordHash: hashDatasetPassword(account.password),
        source: 'dataset' as const,
      }))
      await tx
        .insert(users)
        .values(rows)
        .onConflictDoUpdate({
          target: users.id,
          set: { username: sql`excluded.username`, passwordHash: sql`excluded.password_hash` },
          setWhere: eq(users.source, 'dataset'),
        })
      await tx.delete(memberships).where(
        inArray(
          memberships.userId,
          rows.map((row) => row.id),
        ),
      )
      await tx
        .insert(memberships)
        .values(
          batch.map((account) => ({
            userId: 'dataset:' + account.companyId,
            companyId: account.companyId,
          })),
        )
    }
  })
}
