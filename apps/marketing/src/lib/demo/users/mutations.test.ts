import { describe, expect, it, mock } from 'bun:test';
import {
  deleteUsersPostgres,
  deleteUsersSqlite,
  updateUsersStatusPostgres,
  updateUsersStatusSqlite,
} from './mutations-sql';
import type { PostgresDemoDb } from './postgres/db';
import type { SqliteDemoDb } from './sqlite/db';
import { isUserStatus } from './user-status';

function deleteReturning(ids: Array<string | number>) {
  return {
    where: () => ({
      returning: async () => ids.map((id) => ({ id })),
    }),
  };
}

function updateReturning(ids: Array<string | number>) {
  return {
    set: () => ({
      where: () => ({
        returning: async () => ids.map((id) => ({ id })),
      }),
    }),
  };
}

function selectPosts(postIds: string[]) {
  return {
    from: () => ({
      where: async () => postIds.map((id) => ({ id })),
    }),
  };
}

describe('isUserStatus', () => {
  it('accepts known statuses only', () => {
    expect(isUserStatus('active')).toBe(true);
    expect(isUserStatus('nope')).toBe(false);
    expect(isUserStatus(1)).toBe(false);
  });
});

describe('deleteUsersSqlite', () => {
  it('runs the cascade inside a transaction and returns deleted row count', async () => {
    let deleteCalls = 0;
    const tx = {
      delete: mock(() => {
        deleteCalls += 1;
        return deleteCalls === 3 ? deleteReturning([1]) : deleteReturning([]);
      }),
    };
    const db = {
      transaction: mock(async (fn: (t: typeof tx) => Promise<number>) => fn(tx)),
    } as unknown as SqliteDemoDb;

    const deleted = await deleteUsersSqlite(db, [1, 2, 3]);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(deleted).toBe(1);
  });
});

describe('deleteUsersPostgres', () => {
  it('runs the cascade inside a transaction and returns deleted row count', async () => {
    let deleteCalls = 0;
    const tx = {
      select: mock(() => selectPosts([])),
      delete: mock(() => {
        deleteCalls += 1;
        return deleteCalls === 4 ? deleteReturning(['u1', 'u2']) : deleteReturning([]);
      }),
    };
    const db = {
      transaction: mock(async (fn: (t: typeof tx) => Promise<number>) => fn(tx)),
    } as unknown as PostgresDemoDb;

    const deleted = await deleteUsersPostgres(db, [
      '02ca4de4-fd66-43f8-4a4d-e598711078e1',
      '12ca4de4-fd66-43f8-4a4d-e598711078e1',
      '22ca4de4-fd66-43f8-4a4d-e598711078e1',
    ]);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(deleted).toBe(2);
  });
});

describe('updateUsersStatusSqlite', () => {
  it('returns the number of rows actually updated', async () => {
    const db = {
      update: mock(() => updateReturning([1])),
    } as unknown as SqliteDemoDb;

    const updated = await updateUsersStatusSqlite(db, [1, 2, 3], 'suspended');

    expect(updated).toBe(1);
    expect(db.update).toHaveBeenCalled();
  });
});

describe('updateUsersStatusPostgres', () => {
  it('returns the number of rows actually updated', async () => {
    const db = {
      update: mock(() => updateReturning(['a', 'b'])),
    } as unknown as PostgresDemoDb;

    const updated = await updateUsersStatusPostgres(
      db,
      ['02ca4de4-fd66-43f8-4a4d-e598711078e1', '12ca4de4-fd66-43f8-4a4d-e598711078e1'],
      'active'
    );

    expect(updated).toBe(2);
    expect(db.update).toHaveBeenCalled();
  });
});
