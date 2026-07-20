import { inArray } from 'drizzle-orm';
import type { PostgresDemoDb } from '@/lib/demo/users/postgres/db';
import { schema as pgSchema } from '@/lib/demo/users/postgres/schema';
import type { SqliteDemoDb } from '@/lib/demo/users/sqlite/db';
import { schema as sqliteSchema } from '@/lib/demo/users/sqlite/schema';
import type { UserStatus } from '@/lib/demo/users/user-status';

/** Postgres cascade delete — clear dependents then users, atomically. */
export async function deleteUsersPostgres(db: PostgresDemoDb, uuidIds: string[]): Promise<number> {
  // Neon FKs are not ON DELETE CASCADE — clear dependents first, atomically.
  return db.transaction(async (tx) => {
    await tx.delete(pgSchema.comments).where(inArray(pgSchema.comments.userId, uuidIds));
    const userPosts = await tx
      .select({ id: pgSchema.posts.id })
      .from(pgSchema.posts)
      .where(inArray(pgSchema.posts.userId, uuidIds));
    const postIds = userPosts.map((row) => row.id);
    if (postIds.length > 0) {
      await tx.delete(pgSchema.comments).where(inArray(pgSchema.comments.postId, postIds));
      await tx
        .delete(pgSchema.postCategories)
        .where(inArray(pgSchema.postCategories.postId, postIds));
    }
    await tx.delete(pgSchema.posts).where(inArray(pgSchema.posts.userId, uuidIds));
    await tx.delete(pgSchema.profiles).where(inArray(pgSchema.profiles.userId, uuidIds));
    const deleted = await tx
      .delete(pgSchema.users)
      .where(inArray(pgSchema.users.id, uuidIds))
      .returning({ id: pgSchema.users.id });
    return deleted.length;
  });
}

/** SQLite cascade delete. */
export async function deleteUsersSqlite(db: SqliteDemoDb, numericIds: number[]): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.delete(sqliteSchema.posts).where(inArray(sqliteSchema.posts.userId, numericIds));
    await tx.delete(sqliteSchema.profiles).where(inArray(sqliteSchema.profiles.userId, numericIds));
    const deleted = await tx
      .delete(sqliteSchema.users)
      .where(inArray(sqliteSchema.users.id, numericIds))
      .returning({ id: sqliteSchema.users.id });
    return deleted.length;
  });
}

/** Postgres status update — returns rows actually updated. */
export async function updateUsersStatusPostgres(
  db: PostgresDemoDb,
  uuidIds: string[],
  status: UserStatus
): Promise<number> {
  const updated = await db
    .update(pgSchema.users)
    .set({ status })
    .where(inArray(pgSchema.users.id, uuidIds))
    .returning({ id: pgSchema.users.id });
  return updated.length;
}

/** SQLite status update — returns rows actually updated. */
export async function updateUsersStatusSqlite(
  db: SqliteDemoDb,
  numericIds: number[],
  status: UserStatus
): Promise<number> {
  const updated = await db
    .update(sqliteSchema.users)
    .set({ status })
    .where(inArray(sqliteSchema.users.id, numericIds))
    .returning({ id: sqliteSchema.users.id });
  return updated.length;
}
