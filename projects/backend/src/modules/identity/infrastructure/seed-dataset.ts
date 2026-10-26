import { eq, inArray, sql } from 'drizzle-orm'
import type { Database } from '../../../infrastructure/database/client.js'
import { memberships, users } from '../../../infrastructure/database/schema.js'
export type DatasetAccount = { companyId: string; username: string }
export async function seedDatasetAccounts(db: Database, accounts: readonly DatasetAccount[]) {
  await db.transaction(async (tx) => {
    for (let offset = 0; offset < accounts.length; offset += 500) {
      const batch = accounts.slice(offset, offset + 500)
      const rows = batch.map((account) => ({
        id: 'dataset:' + account.companyId,
        username: account.username,
        sessionVersion: 'dataset-session-v1:' + account.companyId,
        source: 'dataset' as const,
      }))
      await tx
        .insert(users)
        .values(rows)
        .onConflictDoUpdate({
          target: users.id,
          set: { username: sql`excluded.username` },
          setWhere: eq(users.source, 'dataset'),
        })
      await tx.delete(memberships).where(
        inArray(
          memberships.userId,
          rows.map((row) => row.id),
        ),
      )
      await tx.insert(memberships).values(
        batch.map((account) => ({
          userId: 'dataset:' + account.companyId,
          companyId: account.companyId,
        })),
      )
    }
  })
}
