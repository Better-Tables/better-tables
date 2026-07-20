import { inArray } from 'drizzle-orm';
import { getUsersDialect } from './adapter';
import { getPostgresDatabase } from './postgres/db';
import { schema as pgSchema } from './postgres/schema';
import { getSqliteDatabase } from './sqlite/db';
import { schema as sqliteSchema } from './sqlite/schema';

const USER_STATUSES = ['active', 'inactive', 'pending', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && (USER_STATUSES as readonly string[]).includes(value);
}

export { USER_STATUSES };

/** Bulk delete users and dependent rows for the active dialect. */
export async function deleteUsersByIds(ids: string[] | number[]): Promise<number> {
  const dialect = await getUsersDialect();

  if (dialect === 'postgres') {
    const uuidIds = ids as string[];
    const { db } = await getPostgresDatabase();
    // Neon FKs are not ON DELETE CASCADE — clear dependents first.
    await db.delete(pgSchema.comments).where(inArray(pgSchema.comments.userId, uuidIds));
    const userPosts = await db
      .select({ id: pgSchema.posts.id })
      .from(pgSchema.posts)
      .where(inArray(pgSchema.posts.userId, uuidIds));
    const postIds = userPosts.map((row) => row.id);
    if (postIds.length > 0) {
      await db.delete(pgSchema.comments).where(inArray(pgSchema.comments.postId, postIds));
      await db
        .delete(pgSchema.postCategories)
        .where(inArray(pgSchema.postCategories.postId, postIds));
    }
    await db.delete(pgSchema.posts).where(inArray(pgSchema.posts.userId, uuidIds));
    await db.delete(pgSchema.profiles).where(inArray(pgSchema.profiles.userId, uuidIds));
    await db.delete(pgSchema.users).where(inArray(pgSchema.users.id, uuidIds));
    return uuidIds.length;
  }

  const numericIds = ids as number[];
  const { db } = await getSqliteDatabase();
  await db.delete(sqliteSchema.posts).where(inArray(sqliteSchema.posts.userId, numericIds));
  await db.delete(sqliteSchema.profiles).where(inArray(sqliteSchema.profiles.userId, numericIds));
  await db.delete(sqliteSchema.users).where(inArray(sqliteSchema.users.id, numericIds));
  return numericIds.length;
}

/** Bulk status update for the active dialect. */
export async function updateUsersStatus(
  ids: string[] | number[],
  status: UserStatus
): Promise<number> {
  const dialect = await getUsersDialect();

  if (dialect === 'postgres') {
    const uuidIds = ids as string[];
    const { db } = await getPostgresDatabase();
    await db.update(pgSchema.users).set({ status }).where(inArray(pgSchema.users.id, uuidIds));
    return uuidIds.length;
  }

  const numericIds = ids as number[];
  const { db } = await getSqliteDatabase();
  await db
    .update(sqliteSchema.users)
    .set({ status })
    .where(inArray(sqliteSchema.users.id, numericIds));
  return numericIds.length;
}
