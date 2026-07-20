import { getUsersDialect } from '@/lib/demo/users/adapter';
import {
  deleteUsersPostgres,
  deleteUsersSqlite,
  updateUsersStatusPostgres,
  updateUsersStatusSqlite,
} from '@/lib/demo/users/mutations-sql';
import { getPostgresDatabase } from '@/lib/demo/users/postgres/db';
import { getSqliteDatabase } from '@/lib/demo/users/sqlite/db';
import { isUserStatus, USER_STATUSES, type UserStatus } from '@/lib/demo/users/user-status';

export type { UserStatus };
export { isUserStatus, USER_STATUSES };

/** Bulk delete users and dependent rows for the active dialect. */
export async function deleteUsersByIds(ids: string[] | number[]): Promise<number> {
  const dialect = await getUsersDialect();

  if (dialect === 'postgres') {
    const { db } = await getPostgresDatabase();
    return deleteUsersPostgres(db, ids as string[]);
  }

  const { db } = await getSqliteDatabase();
  return deleteUsersSqlite(db, ids as number[]);
}

/** Bulk status update for the active dialect. */
export async function updateUsersStatus(
  ids: string[] | number[],
  status: UserStatus
): Promise<number> {
  const dialect = await getUsersDialect();

  if (dialect === 'postgres') {
    const { db } = await getPostgresDatabase();
    return updateUsersStatusPostgres(db, ids as string[], status);
  }

  const { db } = await getSqliteDatabase();
  return updateUsersStatusSqlite(db, ids as number[], status);
}
