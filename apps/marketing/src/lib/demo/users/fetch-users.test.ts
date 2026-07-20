import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { FetchDataResult } from '@better-tables/core';

const fetchDataMock = mock(
  async (): Promise<FetchDataResult<unknown>> => ({
    data: [{ id: 1, name: 'Ada' }],
    total: 1,
    pagination: { page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false },
  })
);

const withSqlCaptureMock = mock(async <T>(fn: () => Promise<T>) => {
  const result = await fn();
  return {
    result,
    queries: [{ query: 'select * from users where id = ?', params: [1] }],
  };
});

const getTablesMock = mock(async () => ({ fetchData: fetchDataMock }));

mock.module('@/lib/demo/users/adapter', () => ({
  getTables: getTablesMock,
  resetAdapterCaches: () => {},
  getUsersDialect: mock(async () => 'sqlite'),
  getUsersBackendMeta: mock(async () => ({ supportsReset: true })),
  resetUsersDatabase: mock(async () => {}),
  resetUsersBackendForTests: mock(async () => {}),
}));

mock.module('@/lib/db/sql-capture', () => ({
  withSqlCapture: withSqlCaptureMock,
  sqlCaptureLogger: { logQuery() {} },
}));

const actualUserColumns = await import('@/lib/demo/users/columns');

mock.module('@/lib/demo/users/columns', () => ({
  ...actualUserColumns,
  usersTable: { id: 'users' },
}));

const { fetchUsers } = await import('./fetch-users');

describe('fetchUsers', () => {
  beforeEach(() => {
    fetchDataMock.mockClear();
    withSqlCaptureMock.mockClear();
    getTablesMock.mockClear();
  });

  it('returns adapter data and captured SQL queries', async () => {
    const result = await fetchUsers({ page: 2, limit: 5 });

    expect(result.error).toBeNull();
    expect(result.result.total).toBe(1);
    expect(result.queries).toEqual([{ query: 'select * from users where id = ?', params: [1] }]);
    expect(fetchDataMock).toHaveBeenCalled();
  });

  it('returns a safe error payload when the adapter throws', async () => {
    getTablesMock.mockImplementationOnce(async () => {
      throw new Error('sqlite connection closed');
    });

    const result = await fetchUsers({ page: 1, limit: 10 });

    expect(result.error).toBe('sqlite connection closed');
    expect(result.queries).toEqual([]);
    expect(result.result.data).toEqual([]);
  });
});
